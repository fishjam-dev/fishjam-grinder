defmodule Jellygrinder.Coordinator do
  @moduledoc false

  use GenServer, restart: :temporary
  require Logger
  alias Jellygrinder.ClientSupervisor

  defmodule Config do
    @moduledoc false

    @default_client_config [
      server_address: "localhost:5002",
      server_api_token: "development",
      secure?: false
    ]

    @type client_config :: Jellyfish.Client.connection_options()
    @type t :: %__MODULE__{
            client_config: client_config(),
            url: String.t() | nil,
            clients: pos_integer(),
            time: pos_integer(),
            out_path: Path.t()
          }

    defstruct client_config: @default_client_config,
              url: nil,
              clients: 500,
              time: 300,
              out_path: "results.csv"

    @spec fill_hls_url!(t()) :: t() | no_return()
    def fill_hls_url!(%{url: nil} = config) do
      client_config = Keyword.merge(@default_client_config, config.client_config)
      client = Jellyfish.Client.new(client_config)

      case Jellyfish.Room.get_all(client) do
        {:ok, [room | _rest]} ->
          protocol = if client_config[:secure?], do: "https", else: "http"

          %{
            config
            | url: "#{protocol}://#{client_config[:server_address]}/hls/#{room.id}/index.m3u8"
          }

        {:ok, []} ->
          raise "No rooms present on Jellyfish"

        {:error, reason} ->
          raise "Error communicating with Jellyfish: #{inspect(reason)}"
      end
    end

    def fill_hls_url!(config), do: config
  end

  # in ms
  @spawn_interval 200

  @spec run_test(Config.t()) :: :ok | no_return()
  def run_test(config) do
    ref = Process.monitor(__MODULE__)
    GenServer.call(__MODULE__, {:run_test, config})

    receive do
      {:DOWN, ^ref, :process, _pid, reason} ->
        Logger.info("Coordinator process exited with reason #{inspect(reason)}")

        :ok
    end
  end

  @spec start_link(term()) :: GenServer.on_start()
  def start_link(_args) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  @impl true
  def init(_args) do
    Logger.info("Coordinator: Init")

    {:ok, nil}
  end

  @impl true
  def handle_call({:run_test, config}, _from, _state) do
    config = Config.fill_hls_url!(config)

    Logger.info("""
    Coordinator: Start of test
      URL: #{config.url}
      Clients: #{config.clients}
      Time: #{config.time} s
      Save results to: #{config.out_path}
    """)

    Process.send_after(self(), :end_test, config.time * 1000)
    send(self(), :spawn_client)

    state =
      config
      |> Map.from_struct()
      |> Map.merge(%{client_count: 0, results: []})

    {:reply, :ok, state}
  end

  @impl true
  def handle_info({:result, r}, %{results: results} = state) do
    r = amend_result(r, state)

    unless r.success do
      Logger.warning(
        "Coordinator: Request failed (from: #{r.process_name}, label: #{r.label}, code: #{r.response_code})"
      )
    end

    {:noreply, %{state | results: [r | results]}}
  end

  @impl true
  def handle_info(:spawn_client, %{client_count: client_count} = state) do
    if client_count >= state.clients do
      {:noreply, state}
    else
      Process.send_after(self(), :spawn_client, @spawn_interval)
      name = "client-#{client_count}"

      case ClientSupervisor.spawn_client(%{url: state.url, parent: self(), name: name}) do
        {:ok, pid} ->
          Logger.info("Coordinator: #{name} spawned at #{inspect(pid)}")
          _ref = Process.monitor(pid)

          {:noreply, %{state | client_count: client_count + 1}}

        {:error, reason} ->
          Logger.error("Coordinator: Error spawning #{name}: #{inspect(reason)}")

          {:noreply, state}
      end
    end
  end

  @impl true
  def handle_info(:end_test, %{results: results, out_path: out_path} = state) do
    Logger.info("Coordinator: End of test")

    ClientSupervisor.terminate_clients()

    Logger.info("Coordinator: Generating report...")

    results =
      results
      |> Enum.reverse()
      |> Enum.map_join("", &serialize_result/1)

    Logger.info("Coordinator: Saving generated report to #{out_path}...")
    File.write!(out_path, results_header() <> results)
    Logger.info("Coordinator: Report saved successfully. Exiting")

    {:stop, :normal, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, reason}, %{client_count: client_count} = state) do
    Logger.warning("Coordinator: Child process #{inspect(pid)} died: #{inspect(reason)}")

    {:noreply, %{state | client_count: client_count - 1}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp amend_result(result, %{client_count: client_count} = _state) do
    Map.put(result, :client_count, client_count)
  end

  defp results_header() do
    "timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect\n"
  end

  defp serialize_result(r) do
    "#{r.timestamp},#{r.elapsed},#{r.label},#{r.response_code},,#{r.process_name},,#{r.success},#{r.failure_msg},#{r.bytes},-1,#{r.client_count},#{r.client_count},#{r.url},-1,-1,-1\n"
  end
end
