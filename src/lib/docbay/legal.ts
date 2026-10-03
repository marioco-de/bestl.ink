/** Public operator facts. Street and register stay empty until they are real. */
export const LEGAL_OPERATOR = {
  name: "Mario Kempter",
  city: "Augsburg",
  country: "Deutschland",
  email: "privacy@bestl.ink",
};

export type LegalBlock = { title: string; paragraphs: readonly string[] };

export const LEGAL_PAGES = {
  de: {
    imprint: [
      {
        title: "Anbieter",
        paragraphs: [
          "Mario Kempter, Augsburg, Deutschland.",
          "Eine ladungsfähige Anschrift mit Straße und Hausnummer sowie eine Umsatzsteuer-Identifikationsnummer sind hier noch nicht hinterlegt. Bis dahin erreichen Sie den Anbieter über privacy@bestl.ink oder über „Problem melden“.",
        ],
      },
      {
        title: "Kontakt",
        paragraphs: ["E-Mail: privacy@bestl.ink"],
      },
      {
        title: "Verantwortlich für den Inhalt",
        paragraphs: ["Mario Kempter, Anschrift wie oben."],
      },
    ],
    privacy: [
      {
        title: "Verantwortlicher",
        paragraphs: [
          "Für das Konto bei BESTL.INK und für den Betrieb der Plattform ist Mario Kempter, Augsburg, verantwortlich. Kontakt: privacy@bestl.ink.",
          "Wer auf einer eigenen Domain eine eCard oder einen Kurzlink veröffentlicht, ist für diese Inhalte selbst verantwortlich. BESTL.LINK verarbeitet die dabei anfallenden technischen Daten als Auftragsverarbeiter.",
        ],
      },
      {
        title: "Konto",
        paragraphs: [
          "Beim Registrieren speichern wir Name, E-Mail-Adresse und ein Passwort nur als Hash, oder die Kennung des Google-Kontos, wenn Sie sich damit anmelden. Rechtsgrundlage ist der Vertrag, Art. 6 Abs. 1 lit. b DSGVO.",
        ],
      },
      {
        title: "Klicks und Aufrufe",
        paragraphs: [
          "Beim Öffnen eines Kurzlinks oder einer eCard speichern wir Zeitpunkt, gekürzte Adresse, Herkunftsseite, Gerätetyp, ungefähres Land und den User-Agent. Die IP-Adresse wird nur als Hash gespeichert, nicht im Klartext. Damit lassen sich Missbrauch erkennen und die Statistiken des Workspace-Inhabers führen. Rechtsgrundlage ist das berechtigte Interesse, Art. 6 Abs. 1 lit. f DSGVO.",
        ],
      },
      {
        title: "Dokumente, Chat und NDA",
        paragraphs: [
          "Wenn ein Link eine E-Mail-Adresse, einen Namen oder eine Zustimmung verlangt, speichern wir diese Angaben beim jeweiligen Link, zusammen mit Zeitpunkt und gehashter IP. Das braucht der Inhaber des Links, um die Freigabe und eine unterzeichnete NDA nachweisen zu können.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Öffentliche Kurzlinks und eCards setzen kein Tracking-Cookie. Ein Session-Cookie gibt es nur, wenn Sie sich im Workspace anmelden. Das ist technisch nötig, um Sie eingeloggt zu halten. Dafür brauchen wir keine Einwilligung.",
        ],
      },
      {
        title: "Schriften",
        paragraphs: [
          "Die Oberfläche lädt Schriftarten von Google (fonts.googleapis.com). Dabei kann Ihre IP-Adresse an Google in den USA übermittelt werden. Das ist noch nicht DSGVO-konform gelöst und wird auf lokal eingebundene Schriften umgestellt.",
        ],
      },
      {
        title: "Speicherdauer",
        paragraphs: [
          "Kontodaten bleiben, solange das Konto besteht, und werden nach Löschung des Kontos entfernt. Klickdaten und Nachweisdaten zu einer NDA bleiben, solange der zugehörige Link besteht und eine gesetzliche Aufbewahrung es verlangt.",
        ],
      },
      {
        title: "Ihre Rechte",
        paragraphs: [
          "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Eine Einwilligung können Sie jederzeit widerrufen. Beschwerde können Sie bei einer Aufsichtsbehörde einlegen, zuständig ist das Bayerische Landesamt für Datenschutzaufsicht.",
          "Schreiben Sie an privacy@bestl.ink oder nutzen Sie „Problem melden“ und wählen Sie Datenschutz.",
        ],
      },
    ],
    a11y: [
      {
        title: "Stand",
        paragraphs: [
          "Diese Erklärung beschreibt den aktuellen Stand der Website und der eCards. Sie ist noch keine abgeschlossene Prüfung nach dem Barrierefreiheitsstärkungsgesetz.",
        ],
      },
      {
        title: "Was schon geht",
        paragraphs: [
          "Die Seiten sind mit der Tastatur bedienbar, Buttons haben Beschriftungen, und die Darstellung folgt der Schriftgröße des Browsers.",
        ],
      },
      {
        title: "Was noch fehlt",
        paragraphs: [
          "Es gibt noch keine geprüfte Erklärung zur Konformität mit EN 301 549 und keinen vollständigen Prüfbericht. Barrieren können Sie über „Problem melden“ schicken.",
        ],
      },
    ],
  },
  en: {
    imprint: [
      {
        title: "Provider",
        paragraphs: [
          "Mario Kempter, Augsburg, Germany.",
          "A full postal address and a VAT ID are not published here yet. Until then, contact the provider at privacy@bestl.ink or via Report a problem.",
        ],
      },
      {
        title: "Contact",
        paragraphs: ["Email: privacy@bestl.ink"],
      },
    ],
    privacy: [
      {
        title: "Controller",
        paragraphs: [
          "Mario Kempter, Augsburg, is the controller for BESTL.LINK accounts and the platform. Contact: privacy@bestl.ink.",
          "If you publish an eCard or a short link on your own domain, you are responsible for that content. BESTL.LINK processes the technical data as a processor.",
        ],
      },
      {
        title: "Account",
        paragraphs: [
          "We store your name, email address, and a password hash, or your Google account id if you sign in with Google. Legal basis: contract, Art. 6 (1) (b) GDPR.",
        ],
      },
      {
        title: "Clicks",
        paragraphs: [
          "When a short link or an eCard is opened we store the time, the short address, the referrer, device type, approximate country, and the user agent. The IP address is stored only as a hash. Legal basis: legitimate interest, Art. 6 (1) (f) GDPR.",
        ],
      },
      {
        title: "Documents, chat, and NDAs",
        paragraphs: [
          "If a link asks for an email, a name, or consent, we store that with the link, together with the time and a hashed IP, so the link owner can prove access and a signed NDA.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Public short links and eCards do not set a tracking cookie. A session cookie exists only after you sign in to a workspace. It is strictly necessary.",
        ],
      },
      {
        title: "Fonts",
        paragraphs: [
          "The interface loads fonts from Google (fonts.googleapis.com). Your IP address may be sent to Google in the United States. This is not yet a GDPR-safe setup and will be replaced with self-hosted fonts.",
        ],
      },
      {
        title: "Your rights",
        paragraphs: [
          "You can request access, correction, deletion, restriction, portability, and object to processing. You may lodge a complaint with the Bavarian data protection authority (BayLDA).",
          "Email privacy@bestl.ink or use Report a problem and choose Privacy.",
        ],
      },
    ],
    a11y: [
      {
        title: "Status",
        paragraphs: [
          "This note describes the current site and eCards. It is not a completed audit under the German Accessibility Strengthening Act.",
        ],
      },
      {
        title: "What still fails",
        paragraphs: [
          "There is no conformity statement against EN 301 549 yet. Send barriers via Report a problem.",
        ],
      },
    ],
  },
  it: {
    imprint: [
      {
        title: "Titolare",
        paragraphs: [
          "Mario Kempter, Augsburg, Germania.",
          "L’indirizzo postale completo e la partita IVA non sono ancora pubblicati. Fino ad allora: privacy@bestl.ink oppure Segnala un problema.",
        ],
      },
      {
        title: "Contatto",
        paragraphs: ["Email: privacy@bestl.ink"],
      },
    ],
    privacy: [
      {
        title: "Titolare del trattamento",
        paragraphs: [
          "Per gli account BESTL.LINK il titolare è Mario Kempter, Augsburg. Contatto: privacy@bestl.ink.",
          "Chi pubblica una eCard o un link sul proprio dominio è responsabile di quei contenuti. BESTL.LINK tratta i dati tecnici come responsabile del trattamento.",
        ],
      },
      {
        title: "Account e clic",
        paragraphs: [
          "Salviamo nome, email e l’hash della password, oppure l’id Google. All’apertura di un link salviamo ora, referrer, dispositivo, Paese approssimativo e user agent. L’IP è salvato solo come hash.",
        ],
      },
      {
        title: "Cookie e diritti",
        paragraphs: [
          "I link pubblici non impostano cookie di tracciamento. Un cookie di sessione esiste solo dopo l’accesso. Puoi chiedere accesso, rettifica, cancellazione e reclamo all’autorità bavarese (BayLDA). Scrivi a privacy@bestl.ink.",
          "I font arrivano ancora da Google. L’IP può essere trasmesso a Google negli USA. Saranno sostituiti da font locali.",
        ],
      },
    ],
    a11y: [
      {
        title: "Stato",
        paragraphs: [
          "Non c’è ancora una verifica completa secondo EN 301 549. Le barriere si segnalano da Segnala un problema.",
        ],
      },
    ],
  },
} as const;
