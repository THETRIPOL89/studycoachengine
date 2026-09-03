export const metadata = {
  title: 'Privacy Policy',
  description: 'Come Study Coach tratta i tuoi dati personali (GDPR).'
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-6 prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-slate-500">Ultimo aggiornamento: 3 settembre 2026</p>

        <h2>1. Titolare del trattamento</h2>
        <p>
          Studio Coach è un servizio gestito da un singolo sviluppatore (di seguito "il Titolare").
          Per qualsiasi richiesta relativa ai tuoi dati personali scrivi a: <strong>privacy@study-coach.app</strong> (sostituisci con la tua email reale prima del deploy).
        </p>

        <h2>2. Dati che raccogliamo</h2>
        <ul>
          <li><strong>Dati account</strong>: nome, indirizzo email, università e corso di laurea (forniti al momento della registrazione).</li>
          <li><strong>Dati di studio</strong>: esami creati, argomenti, competenze per argomento, sessioni di studio (data, durata, difficoltà, risultato quiz, note), materiali didattici caricati.</li>
          <li><strong>Dati di pagamento</strong>: gestiti interamente da Stripe. Non vediamo né salviamo numeri di carta. Conserviamo solo l'ID cliente Stripe, l'ID sottoscrizione e la data di scadenza del piano Premium.</li>
          <li><strong>Log tecnici</strong>: indirizzo IP, user agent, errori (per manutenzione e sicurezza, conservati al massimo 30 giorni).</li>
        </ul>

        <h2>3. Come usiamo i dati</h2>
        <ul>
          <li>Fornirti il servizio di coaching allo studio (generazione del piano giornaliero, timer, tracciamento competenze, tutor AI).</li>
          <li>Migliorare l'esperienza e correggere bug.</li>
          <li>Gestire il tuo abbonamento Premium (se attivo).</li>
          <li>Rispondere a richieste di supporto.</li>
        </ul>
        <p><strong>Non vendiamo</strong> i tuoi dati a terzi. <strong>Non usiamo</strong> i tuoi dati per addestrare modelli AI.</p>

        <h2>4. Servizi terzi</h2>
        <table>
          <thead>
            <tr><th>Servizio</th><th>Finalità</th><th>Sede</th></tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>Database, autenticazione, storage file</td><td>EU (Frankfurt) o US a seconda del piano scelto</td></tr>
            <tr><td>Vercel</td><td>Hosting applicazione</td><td>Edge network globale</td></tr>
            <tr><td>NVIDIA NIM</td><td>Generazione subtopics (solo titolo esame, mai contenuti personali)</td><td>US</td></tr>
            <tr><td>Groq</td><td>Analisi materiali, quiz, tutor AI</td><td>US</td></tr>
            <tr><td>Stripe</td><td>Pagamenti</td><td>US/EU</td></tr>
          </tbody>
        </table>
        <p>
          Quando carichi un materiale didattico (PDF, slide, appunti), il testo estratto viene inviato a Groq per generare quiz, spiegazioni e analisi del contenuto. <strong>Il file originale resta nel tuo storage Supabase privato</strong> e non viene condiviso con terzi diversi da Groq per la sola analisi.
        </p>

        <h2>5. Conservazione dei dati</h2>
        <p>
          I tuoi dati di studio restano salvati finché mantieni l'account. Se cancelli l'account, tutti i dati personali e di studio vengono eliminati entro 30 giorni (salvo obblighi di legge o conservazione necessaria per gestire controversie di pagamento, in tal caso limitati ai dati strettamente necessari).
        </p>

        <h2>6. I tuoi diritti (GDPR)</h2>
        <p>In qualità di interessato hai diritto a:</p>
        <ul>
          <li><strong>Accesso</strong> (art. 15): sapere quali dati abbiamo su di te.</li>
          <li><strong>Rettifica</strong> (art. 16): correggere dati inesatti.</li>
          <li><strong>Cancellazione</strong> (art. 17): chiedere la cancellazione dei tuoi dati.</li>
          <li><strong>Limitazione</strong> (art. 18): limitare il trattamento in attesa di verifiche.</li>
          <li><strong>Portabilità</strong> (art. 20): ricevere i tuoi dati in formato JSON.</li>
          <li><strong>Opposizione</strong> (art. 21): opporti al trattamento per motivi legittimi.</li>
        </ul>
        <p>Per esercitare questi diritti scrivi a <strong>privacy@study-coach.app</strong>. Rispondiamo entro 30 giorni.</p>
        <p>Hai inoltre diritto a proporre reclamo all'<strong>Garante per la Protezione dei Dati Personali</strong> (www.garanteprivacy.it).</p>

        <h2>7. Sicurezza</h2>
        <p>
          I dati sono protetti da autenticazione obbligatoria, Row-Level Security su Supabase (ogni utente vede solo i propri dati), HTTPS obbligatorio (Vercel) e Stripe per i pagamenti (PCI DSS livello 1). Le chiavi di servizio Supabase sono mantenute server-side e mai esposte al client.
        </p>

        <h2>8. Modifiche a questa policy</h2>
        <p>
          Eventuali modifiche verranno comunicate via email almeno 14 giorni prima dell'entrata in vigore. La versione corrente è sempre disponibile su questa pagina.
        </p>

        <h2>9. Cookie</h2>
        <p>
          Usiamo solo cookie tecnici necessari all'autenticazione (gestiti da Supabase). Nessun cookie di profilazione o tracciamento pubblicitario.
        </p>

        <p className="text-xs text-slate-500 mt-12">
          Questo documento è una base di partenza. Prima del deploy pubblico è consigliata una revisione legale con un avvocato specializzato in privacy/GDPR.
        </p>
      </div>
    </div>
  )
}
