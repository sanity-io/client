# Test TLS certificates

These certificates let `test/proxy.test.ts` run a real local HTTPS server and
CONNECT proxy over TLS, with the client verifying the certificate against a
real CA - instead of disabling certificate verification for the process.

- `ca.pem` - the test CA's public certificate. The proxy tests point
  `NODE_EXTRA_CA_CERTS` (or, where that doesn't take effect, the undici
  agent's `connect: {ca}` option) at this file so the client trusts it.
- `ca.key` - the CA's private key. Not committed (see `.gitignore`): it's
  only needed to regenerate `server/cert.pem`, and committing it would
  invite reuse. Regenerating the server cert means regenerating the CA too,
  since the key never leaves your machine.
- `server/key.pem` / `server/cert.pem` - the server's private key and its
  certificate, signed by the CA above, with a `subjectAltName` covering
  `127.0.0.1` and `localhost`. Node does not honour the certificate's CN for
  hostname verification, so the SAN is required even though the CA is
  trusted.

## Expiry

Both the CA and the server certificate expire **2046-08-07**. There is
nothing to do until then; after that, regenerate both (see below).

## Regenerating

Run from the repo root:

```bash
mkdir -p test/certs/server
cd test/certs

# 1. The CA. 20-year expiry so this does not become someone's Tuesday.
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 7300 \
  -keyout ca.key -out ca.pem \
  -subj "/CN=sanity-client-test-ca"

# 2. The server key and a CSR for 127.0.0.1.
openssl req -newkey rsa:2048 -nodes -sha256 \
  -keyout server/key.pem -out server/csr.pem \
  -subj "/CN=127.0.0.1"

# 3. Sign it, with the SAN Node requires (CN alone is not honoured).
openssl x509 -req -in server/csr.pem -CA ca.pem -CAkey ca.key \
  -CAcreateserial -days 7300 -sha256 \
  -extfile <(printf "subjectAltName=IP:127.0.0.1,DNS:localhost") \
  -out server/cert.pem

rm server/csr.pem ca.srl
cd ../..
```

Because `ca.key` is not committed, regenerating `server/cert.pem` alone is
not possible without also regenerating the CA in step 1 - there's no
existing key to sign with. Run all three steps together.
