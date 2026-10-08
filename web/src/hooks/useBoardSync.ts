import { useEffect } from "react";
import { syncEngine, syncEnabled } from "../data/sync.ts";

/**
 * Liga o quadro ao servidor enquanto o App estiver na tela.
 */
export function useBoardSync() {
  // Efeito 1: ao montar, começa a observar o store e baixa o quadro do servidor.
  // O array vazio [] = roda uma vez, quando o componente aparece.
  // A função devolvida (stop) é o "cleanup": o React a chama quando o componente sai da tela.
  useEffect(() => {
    if (!syncEnabled) return;
    const stop = syncEngine.start();
    void syncEngine.loadFromServer();
    return stop;
  }, []);

  // Efeito 2: quando a internet volta, envia o que ficou pendente na hora.
  useEffect(() => {
    if (!syncEnabled) return;
    function handleOnline() {
      void syncEngine.flush();
    }
    window.addEventListener("online", handleOnline);
    // Cleanup: remove o listener, senão ele se acumularia a cada montagem.
    return () => window.removeEventListener("online", handleOnline);
  }, []);
}
