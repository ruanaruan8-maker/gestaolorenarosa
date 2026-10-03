
import { useState, useEffect, useCallback } from 'react';

import {
  LayoutDashboard,
  Users,
  Upload,
  MessageSquare,
  Settings as SettingsIcon,
  Shield,
  Menu,
  Flower2,
  Lock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

import type {
  Client,
  ClientWithMeta,
  ClientFilter,
} from '@/lib/types';

import { enrichClients, classNames } from '@/lib/utils';

import { DeviceGate } from '@/components/DeviceGate';
import { DeviceManagement } from '@/components/DeviceManagement';
import { Dashboard } from '@/components/Dashboard';
import { ClientList } from '@/components/ClientList';
import { ImportView } from '@/components/ImportView';
import { MessageHistory } from '@/components/MessageHistory';
import { SettingsView } from '@/components/SettingsView';


type View =
  | 'dashboard'
  | 'clients'
  | 'import'
  | 'messages'
  | 'settings';


interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}


const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    icon: LayoutDashboard,
  },
  {
    id: 'clients',
    label: 'Clientes',
    icon: Users,
  },
  {
    id: 'import',
    label: 'Importar',
    icon: Upload,
  },
  {
    id: 'messages',
    label: 'Histórico',
    icon: MessageSquare,
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: SettingsIcon,
  },
];


function App() {
  const [authorized, setAuthorized] = useState(false);

  const [adminMode, setAdminMode] = useState(false);

  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');

  const [showAdminPassword, setShowAdminPassword] =
    useState(false);

  const [adminChecking, setAdminChecking] =
    useState(false);

  const [adminError, setAdminError] =
    useState('');

  const [view, setView] = useState<View>('dashboard');

  const [bucketFilter, setBucketFilter] =
    useState<ClientFilter>('all');

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [clients, setClients] =
    useState<ClientWithMeta[]>([]);

  const [loading, setLoading] = useState(true);


  /*
   * =========================================================
   * CARREGA TODOS OS CLIENTES
   * =========================================================
   *
   * O Supabase pode retornar no máximo 1000 registros
   * por consulta, então carregamos em blocos.
   */
  const loadClients = useCallback(async () => {
    setLoading(true);

    try {
      const allClients: Client[] = [];

      const pageSize = 1000;

      let from = 0;

      while (true) {
        const to = from + pageSize - 1;

        const {
          data,
          error,
        } = await supabase
          .from('clientes')
          .select('*')
          .order('data_ultima_compra', {
            ascending: false,
          })
          .range(from, to);

        if (error) {
          console.error(
            'Erro ao carregar clientes:',
            error
          );

          break;
        }

        if (!data || data.length === 0) {
          break;
        }

        allClients.push(
          ...(data as Client[])
        );

        if (data.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      setClients(
        enrichClients(allClients)
      );

    } catch (error) {
      console.error(
        'Erro ao carregar clientes:',
        error
      );

    } finally {
      setLoading(false);
    }
  }, []);


  /*
   * =========================================================
   * CARREGA OS DADOS PRINCIPAIS
   * =========================================================
   */
  const loadData = useCallback(async () => {
    await loadClients();
  }, [loadClients]);


  /*
   * =========================================================
   * DEPOIS QUE O DISPOSITIVO FOR AUTORIZADO
   * CARREGAMOS OS CLIENTES
   * =========================================================
   */
  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized, loadData]);


  /*
   * =========================================================
   * NAVEGAÇÃO PRINCIPAL
   * =========================================================
   */
  const handleNavigate = (v: View) => {
    setView(v);
    setSidebarOpen(false);
  };


  /*
   * =========================================================
   * SELECIONA UM PERÍODO NO PAINEL
   * =========================================================
   */
  const handleSelectBucket = (
    bucket: ClientFilter
  ) => {
    setBucketFilter(bucket);
    setView('clients');
    setSidebarOpen(false);
  };


  /*
   * =========================================================
   * ABRE O ACESSO ADMINISTRATIVO
   * =========================================================
   *
   * Primeiro exige a senha.
   */
  const handleAdminRequest = () => {
    setAdminPassword('');
    setAdminError('');
    setShowAdminPassword(false);
    setShowAdminLogin(true);
  };


  /*
   * =========================================================
   * CONFERE A SENHA ADMINISTRATIVA
   * =========================================================
   */
  const handleAdminLogin = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!adminPassword.trim()) {
      setAdminError('Digite a senha.');
      return;
    }

    setAdminChecking(true);
    setAdminError('');

    try {
      const { data, error } = await supabase.rpc(
        'verificar_senha_admin',
        {
          p_senha: adminPassword,
        }
      );

      if (error) {
        console.error(
          'Erro ao verificar senha administrativa:',
          error
        );

        setAdminError(
          'Não foi possível verificar a senha.'
        );

        return;
      }

      if (data === true) {
        /*
         * IMPORTANTE:
         * Se estamos entrando pela tela principal,
         * o dispositivo já está autorizado.
         *
         * Se estamos vindo da tela de autorização,
         * também garantimos a autorização aqui.
         */
        setAuthorized(true);

        setAdminPassword('');
        setShowAdminLogin(false);
        setShowAdminPassword(false);
        setAdminError('');

        setAdminMode(true);

      } else {
        setAdminError('Senha incorreta.');
      }

    } catch (error) {
      console.error(
        'Erro ao verificar senha:',
        error
      );

      setAdminError(
        'Não foi possível verificar a senha.'
      );

    } finally {
      setAdminChecking(false);
    }
  };


  /*
   * =========================================================
   * FECHA A JANELA DE SENHA
   * =========================================================
   */
  const closeAdminLogin = () => {
    if (adminChecking) return;

    setShowAdminLogin(false);
    setAdminPassword('');
    setShowAdminPassword(false);
    setAdminError('');
  };


  /*
   * =========================================================
   * VOLTA DO GERENCIAMENTO DE DISPOSITIVOS
   * =========================================================
   *
   * IMPORTANTE:
   * Mantemos o dispositivo autorizado.
   *
   * Ao sair da administração, volta para o Painel.
   */
  const handleBackFromAdmin = () => {
    setAdminMode(false);

    /*
     * Garante que continua autorizado.
     */
    setAuthorized(true);

    /*
     * Sempre volta para o Painel principal.
     */
    setView('dashboard');

    /*
     * Fecha menu mobile, caso esteja aberto.
     */
    setSidebarOpen(false);
  };


  /*
   * =========================================================
   * GERENCIAMENTO DE DISPOSITIVOS
   * =========================================================
   *
   * Só entra aqui depois da senha administrativa correta.
   */
  if (adminMode) {
    return (
      <DeviceManagement
        onBack={handleBackFromAdmin}
      />
    );
  }


  /*
   * =========================================================
   * DISPOSITIVO AINDA NÃO AUTORIZADO
   * =========================================================
   */
  if (!authorized) {
    return (
      <DeviceGate
        onAuthorized={() => {
          setAuthorized(true);
          setAdminMode(false);
          setView('dashboard');
        }}
        onAdminAccess={() => {
          /*
           * O acesso administrativo vindo do DeviceGate
           * também passa a manter o aplicativo autorizado.
           */
          setAuthorized(true);
          setAdminMode(true);
        }}
      />
    );
  }


  const storeName = 'Lorena Rosa';


  return (
    <div className="min-h-screen bg-stone-50 flex">


      {/* =====================================================
          SIDEBAR DESKTOP
      ====================================================== */}

      <aside
        className="
          hidden
          lg:flex
          w-64
          flex-col
          bg-white
          border-r
          border-stone-200
          fixed
          inset-y-0
          left-0
          z-20
        "
      >
        <SidebarContent
          storeName={storeName}
          view={view}
          onNavigate={handleNavigate}
          onAdmin={handleAdminRequest}
        />
      </aside>


      {/* =====================================================
          SIDEBAR MOBILE
      ====================================================== */}

      {sidebarOpen && (
        <>
          <div
            className="
              fixed
              inset-0
              bg-stone-900/30
              backdrop-blur-sm
              z-30
              lg:hidden
            "
            onClick={() => setSidebarOpen(false)}
          />

          <aside
            className="
              fixed
              inset-y-0
              left-0
              w-64
              bg-white
              border-r
              border-stone-200
              z-40
              lg:hidden
              animate-in
              slide-in-from-left
              duration-200
            "
          >
            <SidebarContent
              storeName={storeName}
              view={view}
              onNavigate={handleNavigate}
              onAdmin={handleAdminRequest}
            />
          </aside>
        </>
      )}


      {/* =====================================================
          CONTEÚDO PRINCIPAL
      ====================================================== */}

      <div className="flex-1 lg:ml-64 min-w-0">


        {/* ===================================================
            BARRA MOBILE
        ==================================================== */}

        <div
          className="
            lg:hidden
            bg-white
            border-b
            border-stone-200
            sticky
            top-0
            z-10
            px-4
            py-3
            flex
            items-center
            justify-between
          "
        >

          <button
            onClick={() => setSidebarOpen(true)}
            className="
              p-2
              hover:bg-stone-100
              rounded-lg
              transition-colors
            "
            aria-label="Abrir menu"
          >
            <Menu
              className="
                w-5
                h-5
                text-stone-600
              "
            />
          </button>


          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Flower2
              className="
                w-5
                h-5
                text-rose-500
              "
            />

            <span
              className="
                font-semibold
                text-stone-800
                text-sm
              "
            >
              {storeName}
            </span>
          </div>


          <div className="w-9" />

        </div>


        {/* ===================================================
            PÁGINA
        ==================================================== */}

        <main
          className="
            p-6
            lg:p-8
            max-w-6xl
            mx-auto
          "
        >

          {loading ? (

            <div
              className="
                flex
                items-center
                justify-center
                py-20
              "
            >
              <div
                className="
                  w-10
                  h-10
                  border-4
                  border-stone-200
                  border-t-rose-500
                  rounded-full
                  animate-spin
                "
              />
            </div>

          ) : (

            <>

              {/* =================================================
                  PAINEL
              ================================================== */}

              {view === 'dashboard' && (
                <Dashboard
                  clients={clients}
                  settings={null}
                  onNavigate={handleNavigate}
                  onSelectBucket={handleSelectBucket}
                />
              )}


              {/* =================================================
                  CLIENTES
              ================================================== */}

              {view === 'clients' && (
                <ClientList
                  key={bucketFilter}
                  clients={clients}
                  settings={null}
                  templates={[]}
                  initialBucket={bucketFilter}
                  onClientsChanged={loadData}
                />
              )}


              {/* =================================================
                  IMPORTAÇÃO
              ================================================== */}

              {view === 'import' && (
                <ImportView
                  onImported={async () => {
                    await loadData();
                  }}
                />
              )}


              {/* =================================================
                  HISTÓRICO
              ================================================== */}

              {view === 'messages' && (
                <MessageHistory
                  settings={null}
                />
              )}


              {/* =================================================
                  CONFIGURAÇÕES
              ================================================== */}

              {view === 'settings' && (
                <SettingsView
                  onSettingsChanged={loadData}
                />
              )}

            </>

          )}

        </main>

      </div>


      {/* =====================================================
          LOGIN ADMINISTRATIVO
      ====================================================== */}

      {showAdminLogin && (
        <AdminPasswordModal
          password={adminPassword}
          setPassword={setAdminPassword}
          showPassword={showAdminPassword}
          setShowPassword={setShowAdminPassword}
          checking={adminChecking}
          error={adminError}
          onSubmit={handleAdminLogin}
          onClose={closeAdminLogin}
        />
      )}

    </div>
  );
}


/* =============================================================
   MODAL DE SENHA ADMINISTRATIVA
============================================================= */

function AdminPasswordModal({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  checking,
  error,
  onSubmit,
  onClose,
}: {
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  checking: boolean;
  error: string;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        bg-stone-900/40
        backdrop-blur-sm
        flex
        items-center
        justify-center
        p-4
      "
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >

      <div
        className="
          w-full
          max-w-sm
          bg-white
          rounded-2xl
          shadow-2xl
          border
          border-stone-200
          overflow-hidden
        "
      >

        {/* Cabeçalho */}

        <div
          className="
            px-6
            py-5
            border-b
            border-stone-100
            flex
            items-center
            justify-between
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                w-10
                h-10
                rounded-xl
                bg-rose-50
                flex
                items-center
                justify-center
              "
            >
              <Shield
                className="
                  w-5
                  h-5
                  text-rose-500
                "
              />
            </div>

            <div>

              <h2
                className="
                  font-semibold
                  text-stone-800
                "
              >
                Área administrativa
              </h2>

              <p
                className="
                  text-xs
                  text-stone-400
                  mt-0.5
                "
              >
                Digite a senha para continuar
              </p>

            </div>

          </div>


          <button
            type="button"
            onClick={onClose}
            disabled={checking}
            className="
              p-2
              rounded-lg
              text-stone-400
              hover:bg-stone-100
              hover:text-stone-600
              transition-colors
              disabled:opacity-50
            "
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

        </div>


        {/* Formulário */}

        <form
          onSubmit={onSubmit}
          className="p-6"
        >

          <label
            className="
              block
              text-sm
              font-medium
              text-stone-700
              mb-2
            "
          >
            Senha administrativa
          </label>


          <div className="relative">

            <Lock
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                w-4
                h-4
                text-stone-400
              "
            />

            <input
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoFocus
              autoComplete="current-password"
              placeholder="Digite a senha"
              disabled={checking}
              className="
                w-full
                pl-10
                pr-11
                py-3
                rounded-xl
                border
                border-stone-200
                bg-stone-50
                text-stone-800
                outline-none
                focus:border-rose-400
                focus:ring-2
                focus:ring-rose-100
                transition-all
                disabled:opacity-60
              "
            />


            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              disabled={checking}
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-stone-400
                hover:text-stone-600
                disabled:opacity-50
              "
              aria-label={
                showPassword
                  ? 'Ocultar senha'
                  : 'Mostrar senha'
              }
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>

          </div>


          {error && (
            <div
              className="
                mt-3
                px-3
                py-2.5
                rounded-lg
                bg-red-50
                border
                border-red-100
                text-sm
                text-red-600
              "
            >
              {error}
            </div>
          )}


          <button
            type="submit"
            disabled={
              checking ||
              !password.trim()
            }
            className="
              w-full
              mt-5
              py-3
              rounded-xl
              bg-rose-500
              hover:bg-rose-600
              text-white
              font-semibold
              text-sm
              transition-colors
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {checking
              ? 'Verificando...'
              : 'Entrar no painel'}
          </button>

        </form>

      </div>

    </div>
  );
}


/* =============================================================
   SIDEBAR
============================================================= */

function SidebarContent({
  storeName,
  view,
  onNavigate,
  onAdmin,
}: {
  storeName: string;
  view: View;
  onNavigate: (v: View) => void;
  onAdmin: () => void;
}) {

  return (
    <div
      className="
        flex
        flex-col
        h-full
      "
    >


      {/* =======================================================
          LOGO
      ======================================================== */}

      <div
        className="
          p-6
          border-b
          border-stone-100
        "
      >

        <div
          className="
            flex
            items-center
            gap-3
          "
        >

          <div
            className="
              w-11
              h-11
              rounded-2xl
              bg-gradient-to-br
              from-rose-400
              to-rose-600
              flex
              items-center
              justify-center
              shadow-sm
            "
          >
            <Flower2
              className="
                w-6
                h-6
                text-white
              "
            />
          </div>


          <div className="min-w-0">

            <h1
              className="
                font-bold
                text-stone-800
                text-sm
                truncate
              "
            >
              {storeName}
            </h1>

            <p
              className="
                text-xs
                text-stone-400
              "
            >
              Gestão de Clientes
            </p>

          </div>

        </div>

      </div>


      {/* =======================================================
          NAVEGAÇÃO
      ======================================================== */}

      <nav
        className="
          flex-1
          p-4
          space-y-1
        "
      >

        {navItems.map((item) => {

          const Icon = item.icon;

          const active =
            view === item.id;

          return (
            <button
              key={item.id}
              onClick={() =>
                onNavigate(item.id)
              }
              className={classNames(
                `
                  w-full
                  flex
                  items-center
                  gap-3
                  px-4
                  py-3
                  rounded-xl
                  text-sm
                  font-medium
                  transition-all
                `,
                active
                  ? `
                    bg-rose-50
                    text-rose-600
                  `
                  : `
                    text-stone-500
                    hover:bg-stone-50
                    hover:text-stone-700
                  `
              )}
            >

              <Icon
                className={classNames(
                  'w-5 h-5',
                  active
                    ? 'text-rose-500'
                    : 'text-stone-400'
                )}
              />

              {item.label}

            </button>
          );

        })}

      </nav>


      {/* =======================================================
          ADMINISTRAÇÃO
      ======================================================== */}

      <div
        className="
          p-4
          border-t
          border-stone-100
        "
      >

        <button
          onClick={onAdmin}
          className="
            w-full
            flex
            items-center
            gap-3
            px-4
            py-3
            rounded-xl
            text-sm
            font-medium
            text-stone-400
            hover:bg-stone-50
            hover:text-stone-600
            transition-all
          "
        >

          <Shield
            className="
              w-5
              h-5
              text-stone-400
            "
          />

          Dispositivos

        </button>

      </div>

    </div>
  );
}


export default App;