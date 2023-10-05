defmodule Jellygrinder.Client do
  @moduledoc false

  @type options() :: %{uri: URI.t(), name: String.t()}

  @callback start_link(options()) :: GenServer.on_start()
end
