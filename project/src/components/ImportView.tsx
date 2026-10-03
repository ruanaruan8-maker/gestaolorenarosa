
import { useState, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ImportViewProps {
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  phone: string;
  purchaseDate: string;
}

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface ExistingClient {
  id: string;
  nome: string;
  telefone: string;
  data_ultima_compra: string | null;
  quantidade_compras: number | null;
}

/* ============================================================
   TELEFONE
   ============================================================ */

function normalizePhoneForImport(
  value: string | null | undefined
): string {
  return String(value || '').replace(/\D/g, '');
}

/* ============================================================
   DATA
   ============================================================ */

function parsePurchaseDate(rawDate: string): string {
  const value = rawDate.trim();

  // DD/MM/YYYY
  const brMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];

    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const isoMatch = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Outros formatos reconhecidos pelo navegador
  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return '';
}

/* ============================================================
   CSV
   ============================================================ */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';

  const semicolons =
    (firstLine.match(/;/g) || []).length;

  const commas =
    (firstLine.match(/,/g) || []).length;

  return semicolons >= commas ? ';' : ',';
}

function parseCSVLine(
  line: string,
  delimiter: string
): string[] {
  const result: string[] = [];

  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (
      char === delimiter &&
      !insideQuotes
    ) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result.map((value) =>
    value
      .replace(/^\uFEFF/, '')
      .replace(/^["']|["']$/g, '')
      .trim()
  );
}

function parseCSV(text: string): ParsedRow[] {
  const cleanText = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = cleanText
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error('Arquivo vazio.');
  }

  const delimiter = detectDelimiter(cleanText);

  const headers = parseCSVLine(
    lines[0],
    delimiter
  ).map((header) =>
    header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const clienteIdx = headers.findIndex(
    (header) =>
      header === 'cliente' ||
      header.includes('cliente')
  );

  const dataIdx = headers.findIndex(
    (header) =>
      header === 'data da venda' ||
      header.includes('data da venda') ||
      header === 'data' ||
      header.includes('data')
  );

  if (clienteIdx === -1) {
    throw new Error(
      'Coluna "Cliente" não encontrada. Exporte o relatório de vendas do Phibo.'
    );
  }

  if (dataIdx === -1) {
    throw new Error(
      'Coluna "Data da Venda" não encontrada no arquivo.'
    );
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(
      lines[i],
      delimiter
    );

    const clienteRaw =
      cols[clienteIdx]?.trim() || '';

    const rawDate =
      cols[dataIdx]?.trim() || '';

    if (!clienteRaw || !rawDate) {
      continue;
    }

    /*
      Formato esperado:

      (81) 98510-0589 - Ingrid Lourenço
    */

    const separatorIndex =
      clienteRaw.indexOf(' - ');

    if (separatorIndex === -1) {
      continue;
    }

    const rawPhone =
      clienteRaw
        .slice(0, separatorIndex)
        .trim();

    const name =
      clienteRaw
        .slice(separatorIndex + 3)
        .trim();

    const phone =
      normalizePhoneForImport(rawPhone);

    const normalizedName =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (
      !phone ||
      phone === '00000000000' ||
      phone === '0000000000' ||
      normalizedName.includes('cliente padrao')
    ) {
      continue;
    }

    const purchaseDate =
      parsePurchaseDate(rawDate);

    if (!purchaseDate) {
      continue;
    }

    rows.push({
      name,
      phone,
      purchaseDate,
    });
  }

  return rows;
}

/* ============================================================
   BUSCA TODOS OS CLIENTES
   ============================================================ */

async function loadAllClients(
  onProgress?: (message: string) => void
): Promise<ExistingClient[]> {
  const allClients: ExistingClient[] = [];

  const batchSize = 1000;

  let from = 0;

  while (true) {
    const to = from + batchSize - 1;

    onProgress?.(
      `Carregando clientes do banco... ${from + 1} em diante`
    );

    const {
      data,
      error,
    } = await supabase
      .from('clientes')
      .select(
        'id, nome, telefone, data_ultima_compra, quantidade_compras'
      )
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allClients.push(...data);

    if (data.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return allClients;
}

/* ============================================================
   COMPONENTE
   ============================================================ */

export function ImportView({
  onImported,
}: ImportViewProps) {
  const [file, setFile] =
    useState<File | null>(null);

  const [parsing, setParsing] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [result, setResult] =
    useState<ImportResult | null>(null);

  const [dragOver, setDragOver] =
    useState(false);

  const [parseError, setParseError] =
    useState('');

  const [progressMessage, setProgressMessage] =
    useState('');

  const [fileRows, setFileRows] =
    useState(0);

  /* ==========================================================
     SELECIONAR ARQUIVO
     ========================================================== */

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setParseError('');
      setResult(null);
      setFileRows(0);
      setProgressMessage('');
      setParsing(true);

      try {
        if (
          !selectedFile.name
            .toLowerCase()
            .endsWith('.csv')
        ) {
          throw new Error(
            'Selecione um arquivo CSV do Phibo.'
          );
        }

        const text =
          await selectedFile.text();

        const rows =
          parseCSV(text);

        if (rows.length === 0) {
          throw new Error(
            'Nenhum cliente válido foi encontrado no arquivo. Verifique se o CSV é o relatório de vendas do Phibo.'
          );
        }

        setFileRows(rows.length);
      } catch (err) {
        setFile(null);

        setParseError(
          err instanceof Error
            ? err.message
            : 'Erro ao ler o arquivo.'
        );
      } finally {
        setParsing(false);
      }
    },
    []
  );

  /* ==========================================================
     IMPORTAÇÃO
     ========================================================== */

  const handleImport = async () => {
    if (!file || importing) {
      return;
    }

    setImporting(true);
    setParseError('');
    setResult(null);

    try {
      setProgressMessage(
        'Lendo o arquivo do Phibo...'
      );

      const text =
        await file.text();

      const parsedRows =
        parseCSV(text);

      if (parsedRows.length === 0) {
        throw new Error(
          'Nenhum registro válido foi encontrado no arquivo.'
        );
      }

      /* ======================================================
         AGRUPA POR TELEFONE
         ====================================================== */

      setProgressMessage(
        `Processando ${parsedRows.length} vendas do arquivo...`
      );

      const grouped =
        new Map<
          string,
          {
            name: string;
            phone: string;
            latestDate: string;
            purchasesInFile: number;
          }
        >();

      for (const row of parsedRows) {
        const phone =
          normalizePhoneForImport(
            row.phone
          );

        if (!phone) {
          continue;
        }

        const existing =
          grouped.get(phone);

        if (!existing) {
          grouped.set(phone, {
            name: row.name,
            phone,
            latestDate:
              row.purchaseDate,
            purchasesInFile: 1,
          });
        } else {
          existing.purchasesInFile++;

          if (
            row.purchaseDate >
            existing.latestDate
          ) {
            existing.latestDate =
              row.purchaseDate;
          }

          if (row.name) {
            existing.name =
              row.name;
          }
        }
      }

      if (grouped.size === 0) {
        throw new Error(
          'Nenhum cliente válido foi encontrado após a leitura do arquivo.'
        );
      }

      /* ======================================================
         BUSCA CLIENTES EXISTENTES
         ====================================================== */

      const existingClients =
        await loadAllClients(
          setProgressMessage
        );

      /* ======================================================
         MAPA POR TELEFONE
         ====================================================== */

      const existingMap =
        new Map<string, ExistingClient>();

      for (const client of existingClients) {
        const phone =
          normalizePhoneForImport(
            client.telefone
          );

        if (!phone) {
          continue;
        }

        if (!existingMap.has(phone)) {
          existingMap.set(phone, {
            id: client.id,
            nome: client.nome,
            telefone: client.telefone,
            data_ultima_compra:
              client.data_ultima_compra,
            quantidade_compras:
              client.quantidade_compras,
          });
        }
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      const errors: string[] = [];

      const rowsToInsert: Array<{
        nome: string;
        telefone: string;
        data_ultima_compra: string;
        quantidade_compras: number;
        observacao: string;
      }> = [];

      const rowsToUpdate: Array<{
        id: string;
        nome: string;
        data_ultima_compra: string;
      }> = [];

      /* ======================================================
         SEPARA NOVOS E ATUALIZAÇÕES
         ====================================================== */

      const groupedRows =
        Array.from(grouped.values());

      for (
        let i = 0;
        i < groupedRows.length;
        i++
      ) {
        const row =
          groupedRows[i];

        if (
          i % 100 === 0 ||
          i === groupedRows.length - 1
        ) {
          setProgressMessage(
            `Analisando clientes... ${i + 1} de ${groupedRows.length}`
          );
        }

        const phone =
          normalizePhoneForImport(
            row.phone
          );

        const existing =
          existingMap.get(phone);

        if (existing) {
          const oldDate =
            existing.data_ultima_compra ||
            '';

          if (
            !oldDate ||
            row.latestDate > oldDate
          ) {
            rowsToUpdate.push({
              id: existing.id,
              nome: row.name,
              data_ultima_compra:
                row.latestDate,
            });
          } else {
            skipped++;
          }

          continue;
        }

        rowsToInsert.push({
          nome: row.name,
          telefone: phone,
          data_ultima_compra:
            row.latestDate,
          quantidade_compras:
            row.purchasesInFile,
          observacao: '',
        });
      }

      /* ======================================================
         INSERE NOVOS EM LOTES
         ====================================================== */

      const insertBatchSize = 100;

      for (
        let i = 0;
        i < rowsToInsert.length;
        i += insertBatchSize
      ) {
        const batch =
          rowsToInsert.slice(
            i,
            i + insertBatchSize
          );

        setProgressMessage(
          `Cadastrando clientes novos... ${Math.min(
            i + batch.length,
            rowsToInsert.length
          )} de ${rowsToInsert.length}`
        );

        const {
          data,
          error,
        } = await supabase
          .from('clientes')
          .insert(batch)
          .select(
            'id, nome, telefone, data_ultima_compra, quantidade_compras'
          );

        if (error) {
          /*
            Se houver conflito de telefone, tenta
            novamente cliente por cliente para
            identificar exatamente o problema.
          */

          for (const row of batch) {
            const {
              data: insertedClient,
              error: insertError,
            } = await supabase
              .from('clientes')
              .insert(row)
              .select(
                'id, nome, telefone, data_ultima_compra, quantidade_compras'
              )
              .maybeSingle();

            if (insertError) {
              if (
                insertError.code === '23505' ||
                insertError.message.includes(
                  'clientes_telefone_key'
                )
              ) {
                const duplicate =
                  existingMap.get(
                    normalizePhoneForImport(
                      row.telefone
                    )
                  );

                if (duplicate) {
                  const oldDate =
                    duplicate.data_ultima_compra ||
                    '';

                  if (
                    !oldDate ||
                    row.data_ultima_compra >
                      oldDate
                  ) {
                    const {
                      error:
                        updateError,
                    } =
                      await supabase
                        .from('clientes')
                        .update({
                          nome: row.nome,
                          data_ultima_compra:
                            row.data_ultima_compra,
                          atualizado_em:
                            new Date().toISOString(),
                        })
                        .eq(
                          'id',
                          duplicate.id
                        );

                    if (updateError) {
                      errors.push(
                        `${row.nome}: ${updateError.message}`
                      );
                    } else {
                      updated++;
                    }
                  } else {
                    skipped++;
                  }
                } else {
                  errors.push(
                    `${row.nome}: telefone ${row.telefone} já existe no banco.`
                  );
                }
              } else {
                errors.push(
                  `${row.nome}: ${insertError.message}`
                );
              }

              continue;
            }

            if (insertedClient) {
              inserted++;

              existingMap.set(
                normalizePhoneForImport(
                  row.telefone
                ),
                {
                  id: insertedClient.id,
                  nome: insertedClient.nome,
                  telefone:
                    insertedClient.telefone,
                  data_ultima_compra:
                    insertedClient.data_ultima_compra,
                  quantidade_compras:
                    insertedClient.quantidade_compras,
                }
              );
            }
          }

          continue;
        }

        inserted += data?.length || batch.length;

        if (data) {
          for (const client of data) {
            existingMap.set(
              normalizePhoneForImport(
                client.telefone
              ),
              {
                id: client.id,
                nome: client.nome,
                telefone:
                  client.telefone,
                data_ultima_compra:
                  client.data_ultima_compra,
                quantidade_compras:
                  client.quantidade_compras,
              }
            );
          }
        }
      }

      /* ======================================================
         ATUALIZA CLIENTES EXISTENTES
         ====================================================== */

      for (
        let i = 0;
        i < rowsToUpdate.length;
        i++
      ) {
        const row =
          rowsToUpdate[i];

        setProgressMessage(
          `Atualizando clientes... ${i + 1} de ${rowsToUpdate.length}`
        );

        const {
          error,
        } = await supabase
          .from('clientes')
          .update({
            nome: row.nome,
            data_ultima_compra:
              row.data_ultima_compra,
            atualizado_em:
              new Date().toISOString(),
          })
          .eq('id', row.id);

        if (error) {
          errors.push(
            `${row.nome}: ${error.message}`
          );
        } else {
          updated++;
        }
      }

      /* ======================================================
         MOSTRA RESULTADO
         ====================================================== */

      const finalResult: ImportResult = {
        total: grouped.size,
        inserted,
        updated,
        skipped,
        errors,
      };

      setResult(finalResult);
      setProgressMessage('');

      /*
        IMPORTANTE:
        Não chamamos onImported() automaticamente aqui.

        Assim o resultado permanece visível na tela
        e não desaparece imediatamente.
      */
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : 'Erro ao importar.'
      );

      setProgressMessage('');
    } finally {
      setImporting(false);
    }
  };

  /* ==========================================================
     MODELO CSV
     ========================================================== */

  const downloadTemplate = () => {
    const csv =
      'Origem;Data da Venda;Hora;Cliente;Vendedor;Qtde\n' +
      'PDV;01/10/2026;08:57;(81) 98510-0589 - Maria Silva;Ingrid;1';

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8;',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download =
      'modelo_phibo.csv';

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  };

  /* ==========================================================
     TELA
     ========================================================== */

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          Importar do Phibo
        </h2>

        <p className="text-stone-400 text-sm mt-1">
          Exporte os dados de vendas do Phibo e importe
          aqui para atualizar a base de clientes.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />

          <div className="text-sm text-blue-700 space-y-1.5">
            <p className="font-medium">
              Como importar:
            </p>

            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>
                No Phibo, exporte o relatório de vendas
                em CSV
              </li>

              <li>
                O sistema usa as colunas{' '}
                <strong>Cliente</strong> e{' '}
                <strong>Data da Venda</strong>
              </li>

              <li>
                O telefone é extraído automaticamente
                da coluna Cliente
              </li>

              <li>
                Clientes existentes são identificados
                pelo telefone
              </li>
            </ol>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={downloadTemplate}
        className="
          inline-flex
          items-center
          gap-2
          text-sm
          text-stone-500
          hover:text-stone-700
          transition-colors
        "
      >
        <Download className="w-4 h-4" />
        Baixar modelo de arquivo CSV
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() =>
          setDragOver(false)
        }
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);

          const droppedFile =
            e.dataTransfer.files[0];

          if (droppedFile) {
            handleFile(droppedFile);
          }
        }}
        className={`
          relative
          border-2
          border-dashed
          rounded-2xl
          p-10
          text-center
          transition-all
          ${
            dragOver
              ? 'border-rose-400 bg-rose-50/50'
              : 'border-stone-300 bg-white'
          }
        `}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>

            <div className="text-left">
              <p className="font-medium text-stone-800 text-sm">
                {file.name}
              </p>

              <p className="text-xs text-stone-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>

              {fileRows > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {fileRows} vendas encontradas
                </p>
              )}
            </div>

            {!importing && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setParseError('');
                  setFileRows(0);
                  setProgressMessage('');
                }}
                className="
                  ml-4
                  p-2
                  text-stone-400
                  hover:bg-stone-100
                  rounded-lg
                  transition-colors
                "
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-100 mb-4">
              <UploadCloud className="w-7 h-7 text-stone-400" />
            </div>

            <p className="text-stone-600 font-medium text-sm">
              Arraste o arquivo CSV aqui
            </p>

            <p className="text-stone-400 text-xs mt-1">
              ou clique para selecionar
            </p>

            <label className="mt-4 inline-block">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const selectedFile =
                    e.target.files?.[0];

                  if (selectedFile) {
                    handleFile(selectedFile);
                  }

                  e.currentTarget.value = '';
                }}
              />

              <span
                className="
                  px-5
                  py-2.5
                  bg-stone-800
                  text-white
                  rounded-xl
                  text-sm
                  font-medium
                  cursor-pointer
                  hover:bg-stone-700
                  transition-colors
                  inline-block
                "
              >
                Selecionar arquivo
              </span>
            </label>
          </>
        )}
      </div>

      {parsing && (
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <div className="w-5 h-5 border-2 border-stone-200 border-t-rose-500 rounded-full animate-spin" />

          Analisando arquivo...
        </div>
      )}

      {progressMessage && importing && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin flex-shrink-0" />

            <div>
              <p className="text-sm font-medium text-rose-700">
                Importando...
              </p>

              <p className="text-xs text-rose-600 mt-1">
                {progressMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {parseError && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />

          <div>
            <p className="text-sm font-medium text-rose-700">
              Erro ao processar o arquivo
            </p>

            <p className="text-sm text-rose-600 mt-1">
              {parseError}
            </p>
          </div>
        </div>
      )}

      {file &&
        !parseError &&
        !parsing &&
        !importing &&
        !result && (
          <button
            type="button"
            onClick={handleImport}
            className="
              w-full
              px-5
              py-3.5
              bg-rose-600
              text-white
              rounded-2xl
              hover:bg-rose-700
              transition-colors
              text-sm
              font-medium
              flex
              items-center
              justify-center
              gap-2
            "
          >
            <UploadCloud className="w-5 h-5" />

            Importar clientes
          </button>
        )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />

            <h3 className="font-semibold text-emerald-800">
              Importação concluída!
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ResultStat
              label="Clientes no arquivo"
              value={result.total}
              color="text-stone-700"
            />

            <ResultStat
              label="Novos"
              value={result.inserted}
              color="text-emerald-600"
            />

            <ResultStat
              label="Atualizados"
              value={result.updated}
              color="text-blue-600"
            />

            <ResultStat
              label="Sem alteração"
              value={result.skipped}
              color="text-stone-400"
            />
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
              <p className="font-medium">
                Avisos:
              </p>

              <ul className="list-disc list-inside mt-1 text-xs space-y-1 max-h-48 overflow-auto">
                {result.errors.map(
                  (error, index) => (
                    <li key={index}>
                      {error}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setFile(null);
              setResult(null);
              setParseError('');
              setFileRows(0);
              setProgressMessage('');
            }}
            className="
              mt-5
              w-full
              px-5
              py-3
              bg-white
              border
              border-emerald-200
              text-emerald-700
              rounded-xl
              text-sm
              font-medium
              hover:bg-emerald-50
              transition-colors
            "
          >
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RESULTADO
   ============================================================ */

function ResultStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/60 rounded-xl p-3 text-center">
      <p
        className={`
          text-2xl
          font-bold
          ${color}
          tabular-nums
        `}
      >
        {value}
      </p>

      <p className="text-xs text-stone-500 mt-1">
        {label}
      </p>
    </div>
  );
}