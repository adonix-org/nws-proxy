declare module "cloudflare:test" {
    interface ProvidedEnv extends Env {
        NAMESPACE: KVNamespace;
    }
}
