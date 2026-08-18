export type SplashCopy = {
  flag: string;
  redirect: string;
  redirectOne: string;
  cancel: string;
  go: string;
};

const PACKS: Record<string, SplashCopy> = {
  de: {
    flag: "Gekürzt und gesichert mit BESTL.INK",
    redirect: "Sie werden in {n} Sekunden zu {url} weitergeleitet.",
    redirectOne: "Sie werden in 1 Sekunde zu {url} weitergeleitet.",
    cancel: "Abbrechen",
    go: "Weiter →",
  },
  en: {
    flag: "Shortened & secured with BESTL.INK",
    redirect: "You will be redirected to {url} in {n} seconds.",
    redirectOne: "You will be redirected to {url} in 1 second.",
    cancel: "Cancel",
    go: "Continue →",
  },
  it: {
    flag: "Abbreviato e protetto con BESTL.INK",
    redirect: "Verrai reindirizzato a {url} tra {n} secondi.",
    redirectOne: "Verrai reindirizzato a {url} tra 1 secondo.",
    cancel: "Annulla",
    go: "Avanti →",
  },
  fr: {
    flag: "Raccourci et sécurisé avec BESTL.INK",
    redirect: "Vous serez redirigé vers {url} dans {n} secondes.",
    redirectOne: "Vous serez redirigé vers {url} dans 1 seconde.",
    cancel: "Annuler",
    go: "Continuer →",
  },
  es: {
    flag: "Acortado y protegido con BESTL.INK",
    redirect: "Serás redirigido a {url} en {n} segundos.",
    redirectOne: "Serás redirigido a {url} en 1 segundo.",
    cancel: "Cancelar",
    go: "Continuar →",
  },
  pt: {
    flag: "Encurtado e protegido com BESTL.INK",
    redirect: "Será redirecionado para {url} em {n} segundos.",
    redirectOne: "Será redirecionado para {url} em 1 segundo.",
    cancel: "Cancelar",
    go: "Continuar →",
  },
  nl: {
    flag: "Ingekort en beveiligd met BESTL.INK",
    redirect: "U wordt over {n} seconden doorgestuurd naar {url}.",
    redirectOne: "U wordt over 1 seconde doorgestuurd naar {url}.",
    cancel: "Annuleren",
    go: "Verder →",
  },
  pl: {
    flag: "Skrócone i zabezpieczone przez BESTL.INK",
    redirect: "Za {n} sekundy nastąpi przekierowanie do {url}.",
    redirectOne: "Za 1 sekundę nastąpi przekierowanie do {url}.",
    cancel: "Anuluj",
    go: "Dalej →",
  },
  sv: {
    flag: "Förkortad och säkrad med BESTL.INK",
    redirect: "Du omdirigeras till {url} om {n} sekunder.",
    redirectOne: "Du omdirigeras till {url} om 1 sekund.",
    cancel: "Avbryt",
    go: "Fortsätt →",
  },
  da: {
    flag: "Forkortet og sikret med BESTL.INK",
    redirect: "Du bliver omdirigeret til {url} om {n} sekunder.",
    redirectOne: "Du bliver omdirigeret til {url} om 1 sekund.",
    cancel: "Annuller",
    go: "Fortsæt →",
  },
  fi: {
    flag: "Lyhennetty ja suojattu palvelulla BESTL.INK",
    redirect: "Sinut ohjataan kohteeseen {url} {n} sekunnin kuluttua.",
    redirectOne: "Sinut ohjataan kohteeseen {url} 1 sekunnin kuluttua.",
    cancel: "Peruuta",
    go: "Jatka →",
  },
  no: {
    flag: "Forkortet og sikret med BESTL.INK",
    redirect: "Du blir videresendt til {url} om {n} sekunder.",
    redirectOne: "Du blir videresendt til {url} om 1 sekund.",
    cancel: "Avbryt",
    go: "Fortsett →",
  },
  cs: {
    flag: "Zkráceno a zabezpečeno pomocí BESTL.INK",
    redirect: "Budete přesměrováni na {url} za {n} sekundy.",
    redirectOne: "Budete přesměrováni na {url} za 1 sekundu.",
    cancel: "Zrušit",
    go: "Pokračovat →",
  },
  sk: {
    flag: "Skrátené a zabezpečené pomocou BESTL.INK",
    redirect: "Budete presmerovaní na {url} o {n} sekundy.",
    redirectOne: "Budete presmerovaní na {url} o 1 sekundu.",
    cancel: "Zrušiť",
    go: "Pokračovať →",
  },
  sl: {
    flag: "Skrajšano in zavarovano z BESTL.INK",
    redirect: "Preusmerjeni boste na {url} čez {n} sekunde.",
    redirectOne: "Preusmerjeni boste na {url} čez 1 sekundo.",
    cancel: "Prekliči",
    go: "Nadaljuj →",
  },
  hu: {
    flag: "Rövidítve és védve a BESTL.INK-kel",
    redirect: "{n} másodperc múlva átirányítjuk ide: {url}.",
    redirectOne: "1 másodperc múlva átirányítjuk ide: {url}.",
    cancel: "Mégse",
    go: "Tovább →",
  },
  ro: {
    flag: "Scurtăt și protejat cu BESTL.INK",
    redirect: "Veți fi redirecționat către {url} în {n} secunde.",
    redirectOne: "Veți fi redirecționat către {url} într-o secundă.",
    cancel: "Anulează",
    go: "Continuă →",
  },
  bg: {
    flag: "Съкратено и защитено с BESTL.INK",
    redirect: "Ще бъдете пренасочени към {url} след {n} секунди.",
    redirectOne: "Ще бъдете пренасочени към {url} след 1 секунда.",
    cancel: "Отказ",
    go: "Напред →",
  },
  el: {
    flag: "Συντομευμένο και ασφαλές με BESTL.INK",
    redirect: "Θα ανακατευθυνθείτε στο {url} σε {n} δευτερόλεπτα.",
    redirectOne: "Θα ανακατευθυνθείτε στο {url} σε 1 δευτερόλεπτο.",
    cancel: "Ακύρωση",
    go: "Συνέχεια →",
  },
  hr: {
    flag: "Skraćeno i zaštićeno uz BESTL.INK",
    redirect: "Bit ćete preusmjereni na {url} za {n} sekunde.",
    redirectOne: "Bit ćete preusmjereni na {url} za 1 sekundu.",
    cancel: "Odustani",
    go: "Nastavi →",
  },
  et: {
    flag: "Lühendatud ja turvatud teenusega BESTL.INK",
    redirect: "Teid suunatakse {n} sekundi pärast aadressile {url}.",
    redirectOne: "Teid suunatakse 1 sekundi pärast aadressile {url}.",
    cancel: "Tühista",
    go: "Edasi →",
  },
  lv: {
    flag: "Saīsināts un aizsargāts ar BESTL.INK",
    redirect: "Jūs tiksiet novirzīts uz {url} pēc {n} sekundēm.",
    redirectOne: "Jūs tiksiet novirzīts uz {url} pēc 1 sekundes.",
    cancel: "Atcelt",
    go: "Tālāk →",
  },
  lt: {
    flag: "Sutrumpinta ir apsaugota su BESTL.INK",
    redirect: "Būsite nukreipti į {url} po {n} sek.",
    redirectOne: "Būsite nukreipti į {url} po 1 sekundės.",
    cancel: "Atšaukti",
    go: "Toliau →",
  },
  ga: {
    flag: "Giorraithe agus slánaithe le BESTL.INK",
    redirect: "Atreorófar thú chuig {url} i gceann {n} soicind.",
    redirectOne: "Atreorófar thú chuig {url} i gceann 1 soicind.",
    cancel: "Cealaigh",
    go: "Ar aghaidh →",
  },
  mt: {
    flag: "Iqassar u protett b'BESTL.INK",
    redirect: "Se tiġi ridiretta lejn {url} fi {n} sekondi.",
    redirectOne: "Se tiġi ridiretta lejn {url} f'sekonda 1.",
    cancel: "Ikkanċella",
    go: "Kompli →",
  },
  uk: {
    flag: "Скорочено та захищено з BESTL.INK",
    redirect: "Вас буде перенаправлено на {url} через {n} с.",
    redirectOne: "Вас буде перенаправлено на {url} через 1 секунду.",
    cancel: "Скасувати",
    go: "Далі →",
  },
  ru: {
    flag: "Сокращено и защищено с BESTL.INK",
    redirect: "Вы будете перенаправлены на {url} через {n} с.",
    redirectOne: "Вы будете перенаправлены на {url} через 1 секунду.",
    cancel: "Отмена",
    go: "Далее →",
  },
  tr: {
    flag: "BESTL.INK ile kısaltıldı ve korundu",
    redirect: "{n} saniye içinde {url} adresine yönlendirileceksiniz.",
    redirectOne: "1 saniye içinde {url} adresine yönlendirileceksiniz.",
    cancel: "İptal",
    go: "Devam →",
  },
  sq: {
    flag: "Shkurtuar dhe mbrojtur me BESTL.INK",
    redirect: "Do të ridrejtoheni te {url} pas {n} sekondash.",
    redirectOne: "Do të ridrejtoheni te {url} pas 1 sekonde.",
    cancel: "Anulo",
    go: "Vazhdo →",
  },
  sr: {
    flag: "Skraćeno i zaštićeno uz BESTL.INK",
    redirect: "Bićete preusmereni na {url} za {n} sekundi.",
    redirectOne: "Bićete preusmereni na {url} za 1 sekundu.",
    cancel: "Otkaži",
    go: "Nastavi →",
  },
  bs: {
    flag: "Skraćeno i zaštićeno uz BESTL.INK",
    redirect: "Bit ćete preusmjereni na {url} za {n} sekundi.",
    redirectOne: "Bit ćete preusmjereni na {url} za 1 sekundu.",
    cancel: "Otkaži",
    go: "Nastavi →",
  },
  mk: {
    flag: "Скратено и заштитено со BESTL.INK",
    redirect: "Ќе бидете пренасочени кон {url} за {n} секунди.",
    redirectOne: "Ќе бидете пренасочени кон {url} за 1 секунда.",
    cancel: "Откажи",
    go: "Продолжи →",
  },
  is: {
    flag: "Stytt og varið með BESTL.INK",
    redirect: "Þér verður beint á {url} eftir {n} sekúndur.",
    redirectOne: "Þér verður beint á {url} eftir 1 sekúndu.",
    cancel: "Hætta við",
    go: "Áfram →",
  },
  ca: {
    flag: "Escurçat i protegit amb BESTL.INK",
    redirect: "Se us redirigirà a {url} d’aquí a {n} segons.",
    redirectOne: "Se us redirigirà a {url} d’aquí a 1 segon.",
    cancel: "Cancel·la",
    go: "Continua →",
  },
  cy: {
    flag: "Wedi’i fyrhau a’i ddiogelu gyda BESTL.INK",
    redirect: "Cewch eich ailgyfeirio i {url} ymhen {n} eiliad.",
    redirectOne: "Cewch eich ailgyfeirio i {url} ymhen 1 eiliad.",
    cancel: "Canslo",
    go: "Ymlaen →",
  },
  eu: {
    flag: "BESTL.INK-ekin laburtua eta babestua",
    redirect: "{n} segundo barru {url} helbidera birbideratuko zaitugu.",
    redirectOne: "Segundo 1 barru {url} helbidera birbideratuko zaitugu.",
    cancel: "Utzi",
    go: "Jarraitu →",
  },
  lb: {
    flag: "Gekierzt a geséchert mat BESTL.INK",
    redirect: "Dir gitt an {n} Sekonnen op {url} virugeleet.",
    redirectOne: "Dir gitt an 1 Sekonn op {url} virugeleet.",
    cancel: "Ofbriechen",
    go: "Weider →",
  },
};

const ALIAS: Record<string, string> = {
  nb: "no",
  nn: "no",
  "pt-br": "pt",
  "zh": "en",
};

function format(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] == null ? `{${k}}` : String(vars[k]),
  );
}

export function detectSplashLocale(): string {
  if (typeof navigator === "undefined") return "en";
  const list = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const raw of list) {
    const low = raw.toLowerCase();
    const base = low.split("-")[0] || low;
    if (PACKS[low]) return low;
    if (ALIAS[low] && PACKS[ALIAS[low]]) return ALIAS[low];
    if (PACKS[base]) return base;
    if (ALIAS[base] && PACKS[ALIAS[base]]) return ALIAS[base];
  }
  return "en";
}

export function splashCopy(locale = detectSplashLocale()): SplashCopy {
  return PACKS[locale] || PACKS.en!;
}

export function splashText(
  key: keyof SplashCopy,
  vars?: Record<string, string | number>,
  locale?: string,
): string {
  const pack = splashCopy(locale);
  return format(pack[key], vars);
}
