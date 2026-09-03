export const metadata = {
  title: 'Termini di Servizio',
  description: 'Termini e condizioni d\'uso di Study Coach.'
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-6 prose dark:prose-invert">
        <h1>Termini di Servizio</h1>
        <p className="text-sm text-slate-500">Ultimo aggiornamento: 3 settembre 2026</p>

        <h2>1. Accettazione dei termini</h2>
        <p>
          Utilizzando Study Coach (di seguito "il Servizio") accetti questi Termini di Servizio e la nostra Privacy Policy. Se non sei d'accordo, non utilizzare il Servizio.
        </p>

        <h2>2. Descrizione del servizio</h2>
        <p>
          Study Coach è un coach di studio personale basato su AI per studenti universitari. Funzionalità principali:
        </p>
        <ul>
          <li>Generazione automatica di piani di studio giornalieri</li>
          <li>Timer di sessione con feedback su difficoltà e quiz</li>
          <li>Tracciamento competenze per argomento</li>
          <li>Tutor AI per spiegazioni su concetti</li>
          <li>Generazione di quiz e analisi di materiali didattici</li>
          <li>Calendario studio</li>
        </ul>

        <h2>3. Account</h2>
        <ul>
          <li>Devi fornire un indirizzo email valido e informazioni veritiere al momento della registrazione.</li>
          <li>Sei responsabile della sicurezza delle tue credenziali.</li>
          <li>Puoi cancellare il tuo account in qualsiasi momento dalla pagina profilo (in arrivo) o contattandoci.</li>
        </ul>

        <h2>4. Piano gratuito vs Premium</h2>
        <p>
          Il piano gratuito (Free) permette 1 esame attivo e 1 materiale per esame. Il piano Premium sblocca esami e materiali illimitati più il tutor AI.
        </p>
        <table>
          <thead>
            <tr><th>Piano</th><th>Prezzo</th><th>Cosa include</th></tr>
          </thead>
          <tbody>
            <tr><td>Free</td><td>€0</td><td>1 esame, 1 materiale per esame</td></tr>
            <tr><td>Premium Mensile</td><td>€4.99/mese</td><td>Esami e materiali illimitati, tutor AI</td></tr>
            <tr><td>Premium Semestrale</td><td>€24.99/6 mesi</td><td>Come Premium Mensile (risparmio 17%)</td></tr>
            <tr><td>Premium Annuale</td><td>€49.99/anno</td><td>Come Premium Mensile (risparmio 17%)</td></tr>
          </tbody>
        </table>
        <p>
          I pagamenti sono gestiti da Stripe. Puoi cancellare il rinnovo automatico in qualsiasi momento dal portale clienti (link nella dashboard). Non sono previsti rimborsi per periodi parziali, salvo obblighi di legge.
        </p>

        <h2>5. Uso accettabile</h2>
        <p>Non è consentito:</p>
        <ul>
          <li>Utilizzare il Servizio per scopi illegali.</li>
          <li>Tentare di accedere ad account di altri utenti o a dati non propri.</li>
          <li>Compromettere la sicurezza del Servizio (reverse engineering, attacchi, scraping massivo, ecc.).</li>
          <li>Utilizzare il tutor AI per generare contenuti che violino leggi o diritti di terzi.</li>
          <li>Rivendere o ridistribuire il Servizio senza autorizzazione scritta.</li>
        </ul>

        <h2>6. Proprietà intellettuale</h2>
        <p>
          Il software, il design, i marchi e i contenuti generati dal team di Study Coach sono di nostra proprietà. I tuoi dati di studio (esami, materiali, note) restano tuoi.
        </p>
        <p>
          Le risposte del tutor AI sono generate da modelli di terze parti (Groq, NVIDIA NIM). Non rivendichiamo proprietà su output AI generati per te.
        </p>

        <h2>7. Limitazione di responsabilità</h2>
        <p>
          Study Coach è uno strumento di supporto allo studio, non un sostituto di un tutor umano o di un corso universitario. Non garantiamo il raggiungimento di un determinato voto o risultato accademico.
        </p>
        <p>
          Il Servizio è fornito "così com'è" (as-is). Nei limiti consentiti dalla legge, escludiamo garanzie esplicite o implicite di commerciabilità, idoneità per scopi particolari e non violazione.
        </p>
        <p>
          La nostra responsabilità complessiva per qualsiasi danno derivante dall'uso del Servizio è limitata all'importo pagato da te nei 12 mesi precedenti (o €100 se non hai mai pagato).
        </p>

        <h2>8. Sospensione e cessazione</h2>
        <p>
          Possiamo sospendere o terminare il tuo account se violi questi Termini, con preavviso di 7 giorni quando possibile. In caso di abusi gravi la sospensione è immediata.
        </p>
        <p>
          Se cancelli l'account, i tuoi dati verranno eliminati come descritto nella Privacy Policy.
        </p>

        <h2>9. Modifiche ai termini</h2>
        <p>
          Possiamo modificare questi Termini. Le modifiche sostanziali verranno comunicate via email almeno 14 giorni prima dell'entrata in vigore. L'uso continuato dopo l'entrata in vigore delle modifiche costituisce accettazione.
        </p>

        <h2>10. Legge applicabile e foro</h2>
        <p>
          Questi Termini sono regolati dalla legge italiana. Per controversie tra te e il Titolare, il foro competente è quello del tuo domicilio se consumatore, altrimenti quello della sede del Titolare.
        </p>

        <h2>11. Contatti</h2>
        <p>
          Per domande su questi Termini: <strong>legal@study-coach.app</strong> (sostituisci con la tua email reale prima del deploy).
        </p>

        <p className="text-xs text-slate-500 mt-12">
          Questo documento è una base di partenza. Prima del deploy pubblico è consigliata una revisione legale.
        </p>
      </div>
    </div>
  )
}
