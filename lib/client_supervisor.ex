defmodule Jellygrinder.ClientSupervisor do
  @moduledoc false

  use DynamicSupervisor
  alias Jellygrinder.LLClient

  @spec start_link(term()) :: Supervisor.on_start()
  def start_link(arg) do
    DynamicSupervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @spec spawn_client(module(), term()) :: DynamicSupervisor.on_start_child()
  def spawn_client(client_module \\ LLClient, arg) do
    DynamicSupervisor.start_child(__MODULE__, {client_module, arg})
  end

  @spec terminate_clients() :: :ok
  def terminate_clients() do
    DynamicSupervisor.which_children(__MODULE__)
    |> Enum.each(fn {:undefined, pid, :worker, _modules} ->
      DynamicSupervisor.terminate_child(__MODULE__, pid)
    end)

    :ok
  end

  @impl true
  def init(_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
