const modulePreloadRel = "modulepreload";
const seen = {};
const resolveAssetPath = (asset) =>
  `/cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/${asset}`;

const _ = (loader, dependencies) => {
  let preload = Promise.resolve();

  if (dependencies && dependencies.length > 0) {
    const nonceMeta = document.querySelector("meta[property=csp-nonce]");
    const nonce = nonceMeta?.nonce || nonceMeta?.getAttribute("nonce");

    preload = Promise.allSettled(
      dependencies.map((dependency) => {
        const href = resolveAssetPath(dependency);

        if (href in seen) {
          return undefined;
        }

        seen[href] = true;

        const isStylesheet = href.endsWith(".css");
        const existingSelector = isStylesheet ? '[rel="stylesheet"]' : "";

        if (document.querySelector(`link[href="${href}"]${existingSelector}`)) {
          return undefined;
        }

        const link = document.createElement("link");
        link.rel = isStylesheet ? "stylesheet" : modulePreloadRel;

        if (!isStylesheet) {
          link.as = "script";
        }

        link.crossOrigin = "";
        link.href = href;

        if (nonce) {
          link.setAttribute("nonce", nonce);
        }

        document.head.appendChild(link);

        if (!isStylesheet) {
          return undefined;
        }

        return new Promise((resolve, reject) => {
          link.addEventListener("load", resolve);
          link.addEventListener("error", () =>
            reject(new Error(`Unable to preload CSS for ${href}`)),
          );
        });
      }),
    );
  }

  const onPreloadError = (error) => {
    const event = new Event("vite:preloadError", { cancelable: true });
    event.payload = error;
    window.dispatchEvent(event);

    if (!event.defaultPrevented) {
      throw error;
    }
  };

  return preload.then((results) => {
    for (const result of results || []) {
      if (result.status === "rejected") {
        onPreloadError(result.reason);
      }
    }

    return loader().catch(onPreloadError);
  });
};

function i() {}
function t() {}

export { _, i, t };
