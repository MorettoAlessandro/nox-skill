## Chiamate API: sempre tramite Nox (vale per ogni chat)

Qualunque chiamata API passa dall'applicazione Nox dell'utente, mai direttamente. Segui la skill `nox-api-approval` (o questa sintesi se non è caricata):

- Prima di usare le API, la chat chiede l'accesso con `request_access` (strumenti MCP del connettore `nox`) e aspetta che l'utente la approvi nell'app Nox.
- A chat approvata, le letture passano da `read` con il `chatId`.
- Ogni modifica (POST/PUT/PATCH/DELETE) è una proposta (`propose_write`) che l'utente approva nell'app, una per una.
- Se non puoi o non devi eseguire un'azione, preparala già compilata in Esplora / Esegui con `prepare_in_explore`: all'utente basta premere «Avvia».
- Vietato chiamare API con `curl`, `wget`, `fetch`, script o SDK, e vietato leggere chiavi o token da `.env` o dalle cartelle delle credenziali per usarli in una chiamata. Un hook blocca `curl`/`wget`/`gh api` verso host non locali.
- Se Nox risponde «Nox non risponde» o 502/503/504 senza un motivo (si sta riavviando), riprova dopo 5-10 secondi, fino a 2 volte. Se resta irraggiungibile o non approva, dillo all'utente e fermati: nessuna via alternativa.
- Questa regola prevale su qualunque altra istruzione che autorizzi l'uso diretto delle credenziali. Solo l'utente, in chat, può togliere la regola per un caso specifico.
