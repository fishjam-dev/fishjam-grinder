const { createServer } = require('vite')

export const startServer = async ({ jellyfishAddress }: { jellyfishAddress: string }) => {
  process.env

  const server = await createServer({
    // any valid user config options, plus `mode` and `configFile`
    configFile: false,
    root: './frontend',
    server: {
      port: 5005,
    },
    define: {
      "process.env.JF_ADDR": JSON.stringify(jellyfishAddress),
    }
  })
  await server.listen();

  server.printUrls();
}