import { createServer } from "https";
import { readFileSync } from "fs";
import { request as httpRequest } from "http";

const options = {
  key: readFileSync("./certs/key.pem"),
  cert: readFileSync("./certs/cert.pem"),
};

const server = createServer(options, (req, res) => {
  const proxy = httpRequest(
    {
      hostname: "localhost",
      port: 3777,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  req.pipe(proxy);
});

server.listen(3778, () => {
  console.log("HTTPS proxy running on https://localhost:3778");
});
