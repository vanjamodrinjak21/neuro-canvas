// scripts/generate-se-history-map.mjs
//
// Generira NeuroCanvas mapu (.json) o povijesti i sadašnjosti softverskog
// inženjerstva — na hrvatskom jeziku — s točno 10 000 čvorova.
//
// Format izlaza odgovara DBMapDocument / parseMapJson (app/utils/mapImport.ts):
//   { id, title, nodes[], edges[], camera, settings, rootNodeId,
//     createdAt, updatedAt, tags }
// Čvorovi i bridovi odgovaraju DBNode / DBEdge (app/composables/useDatabase.ts).
//
// Pokretanje:  node scripts/generate-se-history-map.mjs
// Izlaz:       softversko-inzenjerstvo-povijest-i-danas-10k.json  (korijen repo-a)
//
// Sadržaj: kurirana jezgra stvarnih činjenica (ere, jezici, paradigme, pioniri,
// tvrtke, OS-ovi, baze, algoritmi, obrasci, metodologije, alati, mreže,
// sigurnost, testiranje, web, oblak/DevOps, UI/strojno učenje, open source,
// pojmovnik) + strukturirano proširenje pod-aspektima do točno 10 000 čvorova.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'softversko-inzenjerstvo-povijest-i-danas-10k.json')
const TARGET = 10000

// ── Kategorije (boje preuzete iz app/constants/categories.ts) ──────────────
const CAT = {
  root:       '#00D2BE',
  concept:    '#60A5FA',
  fact:       '#4ADE80',
  question:   '#FACC15',
  example:    '#FB923C',
  definition: '#A78BFA',
  process:    '#F472B6',
  note:       '#71717A',
}

// ── Pomoćne funkcije za izgradnju stabla ───────────────────────────────────
let _uid = 0
const nid = () => 'n' + (_uid++).toString(36)

/** Čvor spec: { label, cat, summary?, children?, kind? } */
const N = (label, opts = {}) => ({ label, ...opts })

// ───────────────────────────────────────────────────────────────────────────
//  KURIRANI PODACI
// ───────────────────────────────────────────────────────────────────────────

// 1) Vremenska crta — ere i ključni događaji [godina, naslov, opis]
const TIMELINE = [
  ['1843', 'Ada Lovelace piše prvi algoritam', 'Ada Lovelace opisuje algoritam za Babbageov analitički stroj — često se smatra prvim računalnim programom.'],
  ['1936', 'Turingov stroj', 'Alan Turing formalizira pojam izračunljivosti i univerzalnog stroja, teorijski temelj računarstva.'],
  ['1945', 'Von Neumannova arhitektura', 'John von Neumann opisuje pohranjeni program — arhitektura koja i danas dominira.'],
  ['1947', 'Prvi "bug"', 'Tim Grace Hopper pronalazi moljca u releju Mark II — rođenje pojma "debugging".'],
  ['1949', 'Assembly jezik', 'Pojava simboličkog asemblerskog koda olakšava programiranje u odnosu na strojni kod.'],
  ['1957', 'FORTRAN', 'IBM-ov FORTRAN, prvi široko korišten viši programski jezik, mijenja znanstveno računarstvo.'],
  ['1958', 'LISP', 'John McCarthy stvara LISP, temelj funkcionalnog programiranja i rane umjetne inteligencije.'],
  ['1959', 'COBOL', 'COBOL standardizira poslovno programiranje; mnogi sustavi rade i danas.'],
  ['1968', 'NATO konferencija — "softverska kriza"', 'Na konferenciji u Garmischu skovan je pojam "softversko inženjerstvo".'],
  ['1969', 'UNIX i ARPANET', 'Ken Thompson i Dennis Ritchie počinju UNIX; pokreće se ARPANET, preteča interneta.'],
  ['1970', 'Strukturirano programiranje', 'Dijkstrino "Go To Statement Considered Harmful" oblikuje disciplinu kontrolnog toka.'],
  ['1972', 'Jezik C', 'Dennis Ritchie stvara C — temelj sistemskog programiranja i bezbroj jezika koji slijede.'],
  ['1975', 'Mythical Man-Month', 'Fred Brooks objavljuje klasik o upravljanju softverskim projektima.'],
  ['1980', 'Objektno orijentirano programiranje', 'Smalltalk-80 populariznira OOP; ideje se šire na cijelu industriju.'],
  ['1983', 'C++ i internet protokoli', 'Bjarne Stroustrup proširuje C objektima; ARPANET prelazi na TCP/IP.'],
  ['1985', 'GNU projekt i slobodni softver', 'Richard Stallman pokreće GNU i Free Software Foundation.'],
  ['1989', 'World Wide Web', 'Tim Berners-Lee u CERN-u predlaže Web — HTTP, HTML i URL.'],
  ['1991', 'Linux i Python', 'Linus Torvalds objavljuje Linux jezgru; Guido van Rossum objavljuje Python.'],
  ['1995', 'Java, JavaScript, PHP, Ruby', 'Eksplozija jezika za web i prijenosivost: "Write once, run anywhere".'],
  ['1999', 'Refactoring i agilne ideje', 'Martin Fowler kodificira refaktoriranje; sazrijevaju lagane metode razvoja.'],
  ['2001', 'Agilni manifest', 'Sedamnaest autora potpisuje Manifest agilnog razvoja softvera.'],
  ['2005', 'Git', 'Linus Torvalds stvara Git za distribuirano upravljanje izvornim kodom.'],
  ['2008', 'GitHub i mobilne platforme', 'GitHub mijenja suradnju; pojavljuju se App Store i Android.'],
  ['2009', 'Node.js i DevOps', 'Ryan Dahl predstavlja Node.js; pokret DevOps spaja razvoj i operacije.'],
  ['2013', 'Docker — kontejneri', 'Docker populariznira kontejnerizaciju i mijenja isporuku softvera.'],
  ['2014', 'Kubernetes', 'Google otvara Kubernetes, orkestraciju kontejnera u oblaku.'],
  ['2015', 'Microservisi i moderni frontend', 'Arhitektura mikroservisa i React mijenjaju izgradnju sustava.'],
  ['2017', 'Transformeri', 'Rad "Attention Is All You Need" pokreće modernu eru velikih jezičnih modela.'],
  ['2022', 'Generativni AI ulazi u alate', 'AI asistenti za kod (poput Copilota) i ChatGPT mijenjaju svakodnevni razvoj.'],
  ['2024', 'Agentski razvoj', 'Autonomni AI agenti i "AI-native" alati ubrzavaju softversko inženjerstvo.'],
]

// 2) Programski jezici [naziv, godina, tvorac, paradigma, napomena]
const LANGS = [
  ['FORTRAN', '1957', 'John Backus (IBM)', 'imperativna, proceduralna', 'Prvi viši jezik za znanstveno računarstvo.'],
  ['LISP', '1958', 'John McCarthy', 'funkcionalna', 'Pionir simboličke obrade i rekurzije.'],
  ['COBOL', '1959', 'Grace Hopper i odbor CODASYL', 'imperativna, poslovna', 'Dominantan u poslovnim i bankarskim sustavima.'],
  ['ALGOL 60', '1960', 'Međunarodni odbor', 'strukturirana', 'Uveo blok-strukturu i utjecao na većinu kasnijih jezika.'],
  ['BASIC', '1964', 'Kemeny i Kurtz', 'imperativna', 'Jezik za učenje, masovno raširen na kućnim računalima.'],
  ['Simula 67', '1967', 'Dahl i Nygaard', 'objektno orijentirana', 'Uveo klase i objekte — preteča OOP-a.'],
  ['Pascal', '1970', 'Niklaus Wirth', 'strukturirana, proceduralna', 'Obrazovni jezik s naglaskom na čistu strukturu.'],
  ['C', '1972', 'Dennis Ritchie', 'proceduralna, sistemska', 'Temelj UNIX-a i nebrojenih sustava; statički tipiziran.'],
  ['Smalltalk', '1972', 'Alan Kay i tim (Xerox PARC)', 'čisto objektna', 'Definirao moderno OOP i grafička sučelja.'],
  ['Prolog', '1972', 'Alain Colmerauer', 'logička', 'Deklarativno programiranje temeljeno na logici.'],
  ['ML', '1973', 'Robin Milner', 'funkcionalna', 'Snažna inferencija tipova; preteča Haskella i OCamla.'],
  ['SQL', '1974', 'Chamberlin i Boyce (IBM)', 'deklarativna, upitna', 'Standardni jezik za relacijske baze podataka.'],
  ['Ada', '1980', 'Jean Ichbiah (za američku vojsku)', 'strukturirana, jaka tipizacija', 'Pouzdani sustavi u zrakoplovstvu i obrani.'],
  ['C++', '1983', 'Bjarne Stroustrup', 'višeparadigmatska, OOP', 'C s klasama; visoke performanse i kontrola.'],
  ['Objective-C', '1984', 'Brad Cox', 'objektno orijentirana', 'Smalltalk-poruke nad C-om; temelj Apple ekosustava.'],
  ['Perl', '1987', 'Larry Wall', 'skriptna, višeparadigmatska', 'Snažna obrada teksta i regularni izrazi.'],
  ['Haskell', '1990', 'Akademski odbor', 'čisto funkcionalna, lijena', 'Napredni sustav tipova i referencijalna transparentnost.'],
  ['Python', '1991', 'Guido van Rossum', 'višeparadigmatska', 'Čitljivost i ogroman ekosustav; danas vodeći u podatkovnoj znanosti.'],
  ['Visual Basic', '1991', 'Microsoft', 'događajno-vođena', 'Brzi razvoj Windows aplikacija.'],
  ['Lua', '1993', 'Roberto Ierusalimschy i tim', 'skriptna, ugradiva', 'Laka ugradnja u igre i aplikacije.'],
  ['R', '1993', 'Ihaka i Gentleman', 'statistička, funkcionalna', 'Standard za statistiku i vizualizaciju podataka.'],
  ['Java', '1995', 'James Gosling (Sun)', 'objektno orijentirana', '"Write once, run anywhere" putem JVM-a.'],
  ['JavaScript', '1995', 'Brendan Eich (Netscape)', 'višeparadigmatska, skriptna', 'Jezik weba; danas i na poslužitelju (Node.js).'],
  ['PHP', '1995', 'Rasmus Lerdorf', 'skriptna, web', 'Pokreće velik dio dinamičkog weba.'],
  ['Ruby', '1995', 'Yukihiro Matsumoto', 'objektno orijentirana', 'Elegancija i produktivnost; popularan uz Rails.'],
  ['OCaml', '1996', 'INRIA', 'funkcionalna, imperativna', 'Brz, snažno tipiziran ML iz obitelji.'],
  ['C#', '2000', 'Anders Hejlsberg (Microsoft)', 'objektno orijentirana', 'Glavni jezik .NET platforme.'],
  ['D', '2001', 'Walter Bright', 'višeparadigmatska, sistemska', 'Moderna alternativa C++-u.'],
  ['Scala', '2004', 'Martin Odersky', 'funkcionalna + OOP', 'Spaja paradigme na JVM-u.'],
  ['F#', '2005', 'Don Syme (Microsoft)', 'funkcionalna', 'ML obitelj na .NET-u.'],
  ['Clojure', '2007', 'Rich Hickey', 'funkcionalna (LISP)', 'Nepromjenjivost i konkurentnost na JVM-u.'],
  ['Go', '2009', 'Griesemer, Pike, Thompson (Google)', 'proceduralna, konkurentna', 'Jednostavnost i ugrađena konkurentnost (gorutine).'],
  ['Rust', '2010', 'Graydon Hoare (Mozilla)', 'sistemska, višeparadigmatska', 'Sigurnost memorije bez sakupljača smeća (vlasništvo).'],
  ['Kotlin', '2011', 'JetBrains', 'objektno orijentirana, funkcionalna', 'Moderna zamjena za Javu; službeni za Android.'],
  ['Dart', '2011', 'Google', 'objektno orijentirana', 'Pokreće Flutter za višeplatformska sučelja.'],
  ['Elixir', '2011', 'José Valim', 'funkcionalna, konkurentna', 'Skalabilnost na Erlang VM-u (BEAM).'],
  ['TypeScript', '2012', 'Anders Hejlsberg (Microsoft)', 'nadskup JavaScripta', 'Statička tipizacija nad JavaScriptom.'],
  ['Julia', '2012', 'Bezanson, Edelman i dr.', 'znanstvena, dinamička', 'Visoke performanse za numeričko računarstvo.'],
  ['Swift', '2014', 'Chris Lattner (Apple)', 'višeparadigmatska', 'Siguran, moderan jezik za Apple platforme.'],
  ['Zig', '2016', 'Andrew Kelley', 'sistemska', 'Jednostavnost i eksplicitna kontrola, alternativa C-u.'],
  ['Erlang', '1986', 'Joe Armstrong (Ericsson)', 'funkcionalna, konkurentna', 'Otpornost na greške u telekomunikacijama.'],
  ['Scheme', '1975', 'Sussman i Steele', 'funkcionalna (LISP)', 'Minimalistički dijalekt LISP-a, čest u obrazovanju.'],
  ['Tcl', '1988', 'John Ousterhout', 'skriptna', 'Jednostavno ugradivo skriptiranje.'],
  ['Groovy', '2003', 'James Strachan', 'dinamička (JVM)', 'Dinamično skriptiranje na JVM-u; Gradle.'],
  ['Crystal', '2014', 'Manas tim', 'objektno orijentirana', 'Ruby sintaksa s performansama prevedenog koda.'],
  ['Nim', '2008', 'Andreas Rumpf', 'višeparadigmatska', 'Prevodi se u C; izražajan i brz.'],
  ['Fortran 90', '1991', 'ISO odbor', 'proceduralna', 'Modernizacija FORTRAN-a za znanost.'],
  ['Assembly', '1949', 'razni', 'niskorazinska', 'Simbolički prikaz strojnih instrukcija.'],
  ['COBOL 2002', '2002', 'ISO odbor', 'objektno proširenje', 'Objektno proširen poslovni jezik.'],
  ['Bash', '1989', 'Brian Fox (GNU)', 'skriptna, ljuska', 'Automatizacija na UNIX/Linux sustavima.'],
]

// 3) Paradigme programiranja [naziv, opis, primjeri]
const PARADIGMS = [
  ['Imperativno programiranje', 'Program opisuje korake i promjene stanja eksplicitnim naredbama.', 'C, Pascal, Assembly'],
  ['Proceduralno programiranje', 'Organizacija koda u procedure/funkcije koje se pozivaju.', 'C, Fortran'],
  ['Objektno orijentirano programiranje', 'Podaci i ponašanje vezani su u objekte; enkapsulacija, nasljeđivanje, polimorfizam.', 'Java, C++, Smalltalk'],
  ['Funkcionalno programiranje', 'Računanje kao evaluacija funkcija bez nuspojava; nepromjenjivost.', 'Haskell, Lisp, Elixir'],
  ['Logičko programiranje', 'Program je skup logičkih tvrdnji; rješenje pronalazi sustav.', 'Prolog'],
  ['Deklarativno programiranje', 'Opisuje "što", a ne "kako"; izvršni sustav određuje korake.', 'SQL, HTML, Prolog'],
  ['Konkurentno programiranje', 'Više dretava/procesa izvodi se istodobno; sinkronizacija.', 'Go, Erlang'],
  ['Reaktivno programiranje', 'Tokovi podataka i propagacija promjena.', 'RxJS, Reactive Streams'],
  ['Aspektno orijentirano programiranje', 'Izdvajanje poprečnih briga (logging, sigurnost) u aspekte.', 'AspectJ'],
  ['Generičko programiranje', 'Algoritmi neovisni o konkretnom tipu putem parametara tipa.', 'C++ predlošci, generici'],
  ['Metaprogramiranje', 'Programi koji generiraju ili mijenjaju programe.', 'Lisp makroi, refleksija'],
  ['Programiranje vođeno događajima', 'Tok upravljaju događaji i njihovi rukovatelji.', 'GUI, JavaScript'],
]

// 4) Pioniri i osobe [ime, godine, doprinos]
const PEOPLE = [
  ['Alan Turing', '1912–1954', 'Teorija izračunljivosti, Turingov stroj, temelji informatike i AI.'],
  ['Grace Hopper', '1906–1992', 'Prvi prevoditelj (compiler), suautorica COBOL-a, popularizirala pojam "bug".'],
  ['John von Neumann', '1903–1957', 'Arhitektura pohranjenog programa koja nosi njegovo ime.'],
  ['Edsger Dijkstra', '1930–2002', 'Strukturirano programiranje, algoritam najkraćeg puta, semafori.'],
  ['Donald Knuth', '1938–', 'The Art of Computer Programming, TeX, analiza algoritama.'],
  ['Dennis Ritchie', '1941–2011', 'Tvorac jezika C i suautor UNIX-a.'],
  ['Ken Thompson', '1943–', 'Suautor UNIX-a, B jezik, Go.'],
  ['Bjarne Stroustrup', '1950–', 'Tvorac jezika C++.'],
  ['Linus Torvalds', '1969–', 'Tvorac Linux jezgre i sustava Git.'],
  ['Tim Berners-Lee', '1955–', 'Izumitelj World Wide Weba (HTTP, HTML, URL).'],
  ['Guido van Rossum', '1956–', 'Tvorac jezika Python.'],
  ['James Gosling', '1955–', 'Tvorac jezika Java.'],
  ['Brendan Eich', '1961–', 'Tvorac JavaScripta.'],
  ['Anders Hejlsberg', '1960–', 'Turbo Pascal, Delphi, C#, TypeScript.'],
  ['John McCarthy', '1927–2011', 'Tvorac LISP-a, skovao pojam "umjetna inteligencija".'],
  ['Alan Kay', '1940–', 'Smalltalk, objektno orijentirano programiranje, vizija osobnog računala.'],
  ['Barbara Liskov', '1939–', 'Apstrakcija podataka, Liskovin princip zamjene.'],
  ['Niklaus Wirth', '1934–2024', 'Pascal, Modula, Oberon; "Algoritmi + Strukture podataka = Programi".'],
  ['Margaret Hamilton', '1936–', 'Vodila softver misija Apollo; popularizirala pojam "softversko inženjerstvo".'],
  ['Vint Cerf', '1943–', 'Suautor TCP/IP protokola, "otac interneta".'],
  ['Robert Kahn', '1938–', 'Suautor TCP/IP arhitekture interneta.'],
  ['Fred Brooks', '1931–2022', 'Autor "The Mythical Man-Month", upravljanje softverskim projektima.'],
  ['Martin Fowler', '1963–', 'Refaktoriranje, obrasci enterprise arhitekture, agilne prakse.'],
  ['Kent Beck', '1961–', 'Ekstremno programiranje (XP), Test-Driven Development.'],
  ['Robert C. Martin', '1952–', '"Uncle Bob", čisti kod, SOLID principi.'],
  ['Richard Stallman', '1953–', 'GNU projekt, Free Software Foundation, GPL licenca.'],
  ['Ada Lovelace', '1815–1852', 'Prvi algoritam za stroj; vizionarka programiranja.'],
  ['Claude Shannon', '1916–2001', 'Teorija informacije, digitalni sklopovi.'],
  ['Tony Hoare', '1934–', 'Quicksort, logika Hoare, monitori, "null je pogreška od milijardu dolara".'],
  ['Yukihiro Matsumoto', '1965–', 'Tvorac jezika Ruby.'],
  ['Bill Gates', '1955–', 'Suosnivač Microsofta.'],
  ['Steve Wozniak', '1950–', 'Suosnivač Applea, dizajn Apple I i II.'],
  ['Doug Engelbart', '1925–2013', 'Miš, hipertekst, "Majka svih demonstracija".'],
  ['Leslie Lamport', '1941–', 'Distribuirani sustavi, LaTeX, Paxos, logički sat.'],
  ['Vinton Gray Cerf', '1943–', 'Internet protokoli i upravljanje mrežom.'],
  ['Frances Allen', '1932–2020', 'Optimizacija prevoditelja; prva žena dobitnica Turingove nagrade.'],
]

// 5) Tvrtke i organizacije [naziv, godina, opis]
const COMPANIES = [
  ['IBM', '1911', 'Pionir mainframe računala, FORTRAN-a, relacijskih baza i PC-a.'],
  ['Microsoft', '1975', 'MS-DOS, Windows, Office, .NET, Azure, VS Code.'],
  ['Apple', '1976', 'Osobna računala, macOS, iPhone, Swift.'],
  ['Bell Labs', '1925', 'UNIX, jezik C, tranzistor, mnoge temeljne inovacije.'],
  ['Xerox PARC', '1970', 'Grafičko sučelje, miš, Ethernet, Smalltalk, laser printer.'],
  ['Google', '1998', 'Pretraživanje, Android, Go, Kubernetes, TensorFlow.'],
  ['Sun Microsystems', '1982', 'Java, NFS, Solaris, radne stanice.'],
  ['Oracle', '1977', 'Komercijalne relacijske baze podataka; preuzeo Javu.'],
  ['Mozilla', '1998', 'Firefox, Rust, otvoreni web standardi.'],
  ['Netscape', '1994', 'Navigator preglednik, JavaScript, SSL.'],
  ['Amazon', '1994', 'AWS — pionir računarstva u oblaku.'],
  ['Meta (Facebook)', '2004', 'React, GraphQL, PyTorch, velike društvene platforme.'],
  ['GitHub', '2008', 'Suradnja na kodu putem Gita; danas dio Microsofta.'],
  ['Red Hat', '1993', 'Komercijalna podrška za Linux i otvoreni softver.'],
  ['Intel', '1968', 'Mikroprocesori; x86 arhitektura.'],
  ['NVIDIA', '1993', 'GPU-i, CUDA, ubrzanje strojnog učenja.'],
  ['Atlassian', '2002', 'Jira, Confluence, Bitbucket — alati za timove.'],
  ['JetBrains', '2000', 'IntelliJ IDEA, Kotlin, razvojni alati.'],
  ['Docker Inc.', '2013', 'Popularizacija kontejnera u razvoju softvera.'],
  ['OpenAI', '2015', 'GPT modeli, generativni AI, asistenti za kod.'],
  ['Anthropic', '2021', 'Claude modeli, istraživanje sigurne umjetne inteligencije.'],
  ['HashiCorp', '2012', 'Terraform, Vault, Consul — infrastruktura kao kod.'],
]

// 6) Operacijski sustavi [naziv, godina, opis]
const OS = [
  ['UNIX', '1969', 'Utjecajni višekorisnički sustav; filozofija malih alata.'],
  ['MS-DOS', '1981', 'Komandno-linijski sustav ranih IBM PC-a.'],
  ['Windows', '1985', 'Grafički OS koji dominira osobnim računalima.'],
  ['Mac OS', '1984', 'Pionir masovnog grafičkog sučelja.'],
  ['Linux', '1991', 'Otvorena jezgra; pokreće poslužitelje, mobitele i superračunala.'],
  ['BSD', '1977', 'Berkeleyev UNIX; temelj za FreeBSD, macOS jezgru i dr.'],
  ['Android', '2008', 'Linux-bazirani mobilni OS s najvećim tržišnim udjelom.'],
  ['iOS', '2007', 'Appleov mobilni sustav za iPhone i iPad.'],
  ['Solaris', '1992', 'Sunov UNIX za poslužitelje; ZFS, DTrace.'],
  ['VMS', '1977', 'DEC-ov pouzdani sustav za VAX računala.'],
  ['Plan 9', '1990', 'Bell Labs istraživački nasljednik UNIX-a.'],
  ['FreeRTOS', '2003', 'Operacijski sustav stvarnog vremena za ugrađene uređaje.'],
  ['Chrome OS', '2011', 'Lagan sustav usmjeren na preglednik.'],
  ['QNX', '1982', 'Mikrojezgreni RTOS u automobilima i medicini.'],
]

// 7) Baze podataka [naziv, vrsta, opis]
const DBS = [
  ['Oracle Database', 'relacijska', 'Vodeća komercijalna relacijska baza.'],
  ['MySQL', 'relacijska', 'Najpopularnija otvorena relacijska baza za web.'],
  ['PostgreSQL', 'objektno-relacijska', 'Napredna otvorena baza s bogatim značajkama.'],
  ['SQLite', 'ugrađena relacijska', 'Baza bez poslužitelja, ugrađena u nebrojene aplikacije.'],
  ['Microsoft SQL Server', 'relacijska', 'Microsoftova enterprise baza.'],
  ['MongoDB', 'dokumentna (NoSQL)', 'Fleksibilna pohrana JSON-olikih dokumenata.'],
  ['Redis', 'ključ-vrijednost (u memoriji)', 'Brz međuspremnik i struktura podataka u memoriji.'],
  ['Cassandra', 'širokokolonska (NoSQL)', 'Distribuirana baza visoke dostupnosti.'],
  ['Neo4j', 'grafna', 'Baza za povezane podatke i odnose.'],
  ['Elasticsearch', 'pretraživačka', 'Distribuirano pretraživanje i analitika teksta.'],
  ['DynamoDB', 'ključ-vrijednost (oblak)', 'Amazonova upravljana NoSQL baza.'],
  ['MariaDB', 'relacijska', 'Zajednički razvijen ogranak MySQL-a.'],
  ['CouchDB', 'dokumentna', 'Baza s replikacijom i HTTP API-jem.'],
  ['InfluxDB', 'vremenskih serija', 'Optimizirana za metrike i senzorske podatke.'],
  ['pgvector', 'vektorska (proširenje)', 'Spremanje i pretraga ugrađivanja (embeddings) u PostgreSQL-u.'],
]

// 8) Algoritmi [naziv, kategorija, opis]
const ALGOS = [
  ['Binarno pretraživanje', 'pretraživanje', 'Pronalazak elementa u sortiranom nizu u O(log n).'],
  ['Quicksort', 'sortiranje', 'Brzo sortiranje podijeli-pa-vladaj; prosječno O(n log n).'],
  ['Merge sort', 'sortiranje', 'Stabilno sortiranje spajanjem; zajamčeno O(n log n).'],
  ['Heap sort', 'sortiranje', 'Sortiranje pomoću binarne hrpe.'],
  ['Dijkstrin algoritam', 'graf', 'Najkraći put od izvora u grafu s nenegativnim težinama.'],
  ['A*', 'graf, pretraga', 'Heuristička pretraga najkraćeg puta.'],
  ['Pretraga u širinu (BFS)', 'graf', 'Obilazak grafa razinu po razinu.'],
  ['Pretraga u dubinu (DFS)', 'graf', 'Obilazak grafa u dubinu uz povratak.'],
  ['Dinamičko programiranje', 'tehnika', 'Rješavanje problema preklapanjem podproblema.'],
  ['Pohlepni algoritmi', 'tehnika', 'Lokalno optimalni izbori za globalno rješenje.'],
  ['Podijeli pa vladaj', 'tehnika', 'Rekurzivno dijeljenje problema na manje dijelove.'],
  ['Hashiranje', 'struktura/tehnika', 'Preslikavanje ključeva u indekse za brz pristup.'],
  ['Bellman–Ford', 'graf', 'Najkraći put uz moguće negativne težine.'],
  ['Kruskalov algoritam', 'graf', 'Minimalno razapinjuće stablo spajanjem bridova.'],
  ['Primov algoritam', 'graf', 'Minimalno razapinjuće stablo rastom iz čvora.'],
  ['Knuth–Morris–Pratt', 'nizovi', 'Učinkovito pretraživanje uzorka u tekstu.'],
  ['Brzo množenje matrica', 'numerika', 'Strassenov algoritam ispod O(n³).'],
  ['Gradijentni spust', 'optimizacija', 'Iterativno minimiziranje funkcije gubitka.'],
  ['RSA', 'kriptografija', 'Asimetrična enkripcija temeljena na faktorizaciji.'],
  ['Huffmanovo kodiranje', 'kompresija', 'Optimalno prefiksno kodiranje za kompresiju.'],
]

// 9) Strukture podataka [naziv, opis]
const DS = [
  ['Niz (Array)', 'Indeksirana sekvenca elemenata; konstantan pristup po indeksu.'],
  ['Povezana lista', 'Čvorovi povezani pokazivačima; učinkovito umetanje.'],
  ['Stog (Stack)', 'LIFO struktura — zadnji unutra, prvi van.'],
  ['Red (Queue)', 'FIFO struktura — prvi unutra, prvi van.'],
  ['Hash tablica', 'Preslikavanje ključ–vrijednost s prosječno O(1) pristupom.'],
  ['Binarno stablo pretraživanja', 'Uređeno stablo za brzo pretraživanje.'],
  ['AVL / crveno-crno stablo', 'Samouravnotežena stabla s zajamčenom visinom.'],
  ['Hrpa (Heap)', 'Stablo s prioritetom; temelj prioritetnog reda.'],
  ['Graf', 'Čvorovi i bridovi za modeliranje odnosa.'],
  ['Trie (prefiksno stablo)', 'Stablo za učinkovitu pretragu nizova/prefiksa.'],
  ['B-stablo', 'Uravnoteženo stablo za baze i datotečne sustave.'],
  ['Bloomov filtar', 'Probabilistička provjera pripadnosti skupu.'],
  ['Disjunktni skupovi (Union-Find)', 'Učinkovito spajanje i provjera skupova.'],
  ['Skip lista', 'Vjerojatnosna alternativa uravnoteženim stablima.'],
]

// 10) Oblikovni obrasci [naziv, kategorija, opis]
const PATTERNS = [
  ['Singleton', 'kreacijski', 'Jamči jednu instancu klase i globalni pristup.'],
  ['Factory Method', 'kreacijski', 'Delegira stvaranje objekata podklasama.'],
  ['Abstract Factory', 'kreacijski', 'Obitelji povezanih objekata bez konkretnih klasa.'],
  ['Builder', 'kreacijski', 'Postupna izgradnja složenih objekata.'],
  ['Prototype', 'kreacijski', 'Stvaranje objekata kloniranjem prototipa.'],
  ['Adapter', 'strukturni', 'Prilagodba nekompatibilnih sučelja.'],
  ['Decorator', 'strukturni', 'Dinamičko dodavanje ponašanja objektu.'],
  ['Facade', 'strukturni', 'Jednostavno sučelje nad složenim podsustavom.'],
  ['Proxy', 'strukturni', 'Zamjenik koji kontrolira pristup objektu.'],
  ['Composite', 'strukturni', 'Stablo objekata tretirano jednoliko.'],
  ['Bridge', 'strukturni', 'Odvajanje apstrakcije od implementacije.'],
  ['Flyweight', 'strukturni', 'Dijeljenje sitnih objekata radi uštede memorije.'],
  ['Observer', 'ponašajni', 'Obavještavanje pretplatnika o promjenama stanja.'],
  ['Strategy', 'ponašajni', 'Zamjenjivi algoritmi iza zajedničkog sučelja.'],
  ['Command', 'ponašajni', 'Zahtjev kao objekt; podrška za undo.'],
  ['Iterator', 'ponašajni', 'Sekvencijalni pristup elementima zbirke.'],
  ['State', 'ponašajni', 'Promjena ponašanja ovisno o unutarnjem stanju.'],
  ['Template Method', 'ponašajni', 'Kostur algoritma s koracima u podklasama.'],
  ['Visitor', 'ponašajni', 'Operacije nad strukturom bez mijenjanja klasa.'],
  ['Mediator', 'ponašajni', 'Centralizirana komunikacija među objektima.'],
  ['Chain of Responsibility', 'ponašajni', 'Lanac rukovatelja koji obrađuju zahtjev.'],
  ['Memento', 'ponašajni', 'Spremanje i obnova stanja objekta.'],
  ['MVC', 'arhitekturni', 'Razdvajanje modela, pogleda i upravljača.'],
]

// 11) Arhitektura softvera [naziv, opis]
const ARCH = [
  ['Monolitna arhitektura', 'Cijela aplikacija u jednoj jedinici isporuke.'],
  ['Slojevita arhitektura', 'Prezentacija, logika i podaci u odvojenim slojevima.'],
  ['Mikroservisi', 'Male, neovisno isporučive usluge oko poslovnih sposobnosti.'],
  ['Arhitektura vođena događajima', 'Komponente komuniciraju asinkronim događajima.'],
  ['Servisno orijentirana arhitektura (SOA)', 'Funkcije izložene kao mrežne usluge.'],
  ['Heksagonalna arhitektura', 'Jezgra odvojena od vanjskog svijeta portovima i adapterima.'],
  ['Čista arhitektura', 'Pravila ovisnosti usmjerena prema unutra, ka domeni.'],
  ['CQRS', 'Odvajanje čitanja od pisanja u odvojene modele.'],
  ['Event Sourcing', 'Stanje rekonstruirano iz slijeda događaja.'],
  ['Serverless', 'Logika kao funkcije bez upravljanja poslužiteljima.'],
  ['Klijent–poslužitelj', 'Klijenti traže usluge od centralnog poslužitelja.'],
  ['Peer-to-peer', 'Ravnopravni čvorovi dijele resurse bez središta.'],
  ['Cjevovod i filtri (Pipes and Filters)', 'Obrada podataka kroz niz transformacija.'],
  ['Mikro-frontend', 'Frontend podijeljen na neovisne timske dijelove.'],
]

// 12) Metodologije i procesi [naziv, opis]
const METHODS = [
  ['Vodopadni model (Waterfall)', 'Sekvencijalne faze: analiza, dizajn, implementacija, testiranje.'],
  ['Spiralni model', 'Iterativni razvoj s naglaskom na upravljanje rizicima.'],
  ['V-model', 'Razvoj uparen s odgovarajućim razinama testiranja.'],
  ['Rational Unified Process (RUP)', 'Iterativni okvir s fazama i disciplinama.'],
  ['Agilni razvoj', 'Inkrementalna isporuka, suradnja i prilagodljivost.'],
  ['Scrum', 'Sprintovi, uloge (PO, Scrum Master), dnevni standup.'],
  ['Kanban', 'Vizualizacija toka rada i ograničenje rada u tijeku.'],
  ['Ekstremno programiranje (XP)', 'Parno programiranje, TDD, kontinuirana integracija.'],
  ['Lean razvoj softvera', 'Eliminacija gubitaka i optimizacija toka vrijednosti.'],
  ['DevOps', 'Spajanje razvoja i operacija; automatizacija isporuke.'],
  ['Test-Driven Development (TDD)', 'Prvo test, zatim kod koji ga zadovoljava.'],
  ['Behaviour-Driven Development (BDD)', 'Specifikacije ponašanja razumljive svima.'],
  ['Continuous Integration', 'Često spajanje i automatsko testiranje koda.'],
  ['Continuous Delivery', 'Kod uvijek spreman za isporuku u produkciju.'],
  ['Domain-Driven Design (DDD)', 'Modeliranje softvera oko poslovne domene.'],
  ['Pair programming', 'Dva programera rade zajedno na jednom kodu.'],
]

// 13) Alati i ekosustav [naziv, kategorija, opis]
const TOOLS = [
  ['Git', 'kontrola verzija', 'Distribuirano upravljanje izvornim kodom.'],
  ['Subversion (SVN)', 'kontrola verzija', 'Centralizirano verzioniranje.'],
  ['Mercurial', 'kontrola verzija', 'Distribuirani sustav, alternativa Gitu.'],
  ['Make', 'izgradnja', 'Klasičan alat za automatizaciju izgradnje.'],
  ['Maven', 'izgradnja (Java)', 'Upravljanje ovisnostima i izgradnja.'],
  ['Gradle', 'izgradnja', 'Fleksibilna izgradnja temeljena na Groovyju/Kotlinu.'],
  ['npm', 'paketi (JS)', 'Registar i upravitelj paketa za JavaScript.'],
  ['pip', 'paketi (Python)', 'Instalacija Python paketa s PyPI-a.'],
  ['Cargo', 'paketi (Rust)', 'Izgradnja i upravljanje ovisnostima u Rustu.'],
  ['Docker', 'kontejneri', 'Pakiranje aplikacija u prijenosive kontejnere.'],
  ['Kubernetes', 'orkestracija', 'Upravljanje kontejnerima u velikim sustavima.'],
  ['Jenkins', 'CI/CD', 'Automatizacija izgradnje i isporuke.'],
  ['GitHub Actions', 'CI/CD', 'Tijekovi rada integrirani s GitHubom.'],
  ['Terraform', 'infrastruktura kao kod', 'Deklarativno upravljanje infrastrukturom.'],
  ['Ansible', 'automatizacija', 'Konfiguracija sustava bez agenata.'],
  ['VS Code', 'uređivač', 'Popularan, proširiv uređivač koda.'],
  ['Vim', 'uređivač', 'Modalni uređivač s dugom tradicijom.'],
  ['IntelliJ IDEA', 'IDE', 'Moćno razvojno okruženje za JVM jezike.'],
  ['Webpack', 'bundler', 'Pakiranje frontend modula i resursa.'],
  ['Vite', 'bundler', 'Brz razvojni poslužitelj i izgradnja.'],
  ['ESLint', 'kvaliteta koda', 'Statička analiza i stil JavaScripta.'],
  ['Prettier', 'formatiranje', 'Automatsko oblikovanje koda.'],
]

// 14) Mreže i protokoli [naziv, opis]
const NET = [
  ['TCP/IP', 'Temeljni skup protokola interneta.'],
  ['HTTP', 'Protokol za prijenos hiperteksta na webu.'],
  ['HTTPS / TLS', 'Šifrirana inačica HTTP-a putem TLS-a.'],
  ['DNS', 'Sustav imena domena — preslikavanje imena u IP adrese.'],
  ['HTTP/2', 'Multipleksirani, učinkovitiji prijenos.'],
  ['HTTP/3 (QUIC)', 'Transport nad UDP-om s manjom latencijom.'],
  ['WebSocket', 'Dvosmjerna komunikacija u stvarnom vremenu.'],
  ['REST', 'Arhitekturni stil za web API-je.'],
  ['GraphQL', 'Upitni jezik za API-je s preciznim dohvaćanjem.'],
  ['gRPC', 'Brz RPC okvir temeljen na HTTP/2 i Protobufu.'],
  ['SMTP / IMAP', 'Protokoli za slanje i dohvat e-pošte.'],
  ['FTP / SFTP', 'Prijenos datoteka preko mreže.'],
  ['SSH', 'Sigurna udaljena ljuska i tuneliranje.'],
  ['MQTT', 'Lagani protokol za Internet stvari.'],
]

// 15) Sigurnost softvera [naziv, opis]
const SECURITY = [
  ['SQL injekcija', 'Ubacivanje zlonamjernog SQL-a kroz nevalidirani unos.'],
  ['Cross-Site Scripting (XSS)', 'Ubacivanje skripti u web stranice koje vide drugi.'],
  ['Cross-Site Request Forgery (CSRF)', 'Zlouporaba autenticirane sesije korisnika.'],
  ['Prelijevanje međuspremnika', 'Pisanje izvan granica memorije; klasična ranjivost.'],
  ['Autentikacija i autorizacija', 'Provjera identiteta i prava pristupa.'],
  ['Šifriranje (enkripcija)', 'Zaštita povjerljivosti podataka.'],
  ['Hashiranje lozinki', 'Sigurna pohrana lozinki (bcrypt, Argon2).'],
  ['OWASP Top 10', 'Popis najčešćih web ranjivosti.'],
  ['Princip najmanjih ovlasti', 'Dodjela samo nužnih prava.'],
  ['Sigurnost lanca opskrbe', 'Zaštita od kompromitiranih ovisnosti.'],
  ['Zero Trust', 'Nema implicitnog povjerenja; stalna provjera.'],
  ['Penetracijsko testiranje', 'Simulirani napadi radi pronalaska slabosti.'],
  ['Upravljanje tajnama', 'Sigurno čuvanje ključeva i vjerodajnica.'],
  ['Sigurnost po dizajnu', 'Ugrađivanje sigurnosti od početka razvoja.'],
]

// 16) Testiranje i kvaliteta [naziv, opis]
const TESTING = [
  ['Jedinično testiranje (Unit)', 'Provjera pojedinačnih jedinica koda.'],
  ['Integracijsko testiranje', 'Provjera suradnje više komponenti.'],
  ['Sistemsko testiranje', 'Provjera sustava kao cjeline.'],
  ['Testiranje prihvaćanja', 'Potvrda da sustav zadovoljava zahtjeve.'],
  ['Regresijsko testiranje', 'Provjera da promjene nisu pokvarile postojeće.'],
  ['Testiranje performansi', 'Mjerenje brzine i opterećenja.'],
  ['Testiranje opterećenja (Load)', 'Ponašanje pod očekivanim i vršnim prometom.'],
  ['End-to-end testiranje', 'Simulacija stvarnih korisničkih tijekova.'],
  ['Mockovi i stubovi', 'Zamjena ovisnosti radi izolacije.'],
  ['Pokrivenost koda', 'Mjera koliko koda izvršavaju testovi.'],
  ['Property-based testiranje', 'Generiranje slučajnih ulaza za svojstva.'],
  ['Fuzz testiranje', 'Slučajni ulazi za otkrivanje grešaka i ranjivosti.'],
  ['Statička analiza', 'Pronalazak grešaka bez izvođenja koda.'],
  ['Kontinuirano testiranje', 'Automatski testovi u svakom koraku isporuke.'],
]

// 17) Web tehnologije [naziv, opis]
const WEB = [
  ['HTML', 'Jezik za strukturu web stranica.'],
  ['CSS', 'Jezik za izgled i raspored web stranica.'],
  ['DOM', 'Objektni model dokumenta kojim manipulira JavaScript.'],
  ['AJAX', 'Asinkrono dohvaćanje podataka bez ponovnog učitavanja.'],
  ['React', 'Knjižnica za komponentna korisnička sučelja.'],
  ['Vue.js', 'Progresivni okvir za sučelja.'],
  ['Angular', 'Sveobuhvatan okvir za web aplikacije.'],
  ['Svelte', 'Okvir koji prevodi komponente u učinkovit kod.'],
  ['Node.js', 'JavaScript izvedbeno okruženje na poslužitelju.'],
  ['WebAssembly', 'Brzi prenosivi binarni format u pregledniku.'],
  ['Progresivne web aplikacije (PWA)', 'Web aplikacije s mogućnostima izvornih.'],
  ['Server-Side Rendering', 'Renderiranje stranica na poslužitelju.'],
  ['Web Components', 'Standard za ponovno upotrebljive elemente.'],
  ['Single Page Application', 'Aplikacija koja se izvodi unutar jedne stranice.'],
]

// 18) Mobilni i ugrađeni razvoj [naziv, opis]
const MOBILE = [
  ['Android SDK', 'Razvojni alati za Android platformu.'],
  ['iOS / SwiftUI', 'Razvoj nativnih sučelja za Apple uređaje.'],
  ['React Native', 'Višeplatformske aplikacije u JavaScriptu.'],
  ['Flutter', 'Višeplatformska sučelja pomoću Darta.'],
  ['Capacitor / Cordova', 'Web tehnologije u nativnim omotačima.'],
  ['Ugrađeni sustavi', 'Softver za uređaje s ograničenim resursima.'],
  ['Internet stvari (IoT)', 'Povezani senzori i uređaji.'],
  ['Mikrokontroleri (Arduino, ESP32)', 'Programabilne pločice za hardver.'],
  ['RTOS', 'Operacijski sustavi stvarnog vremena.'],
  ['Energetska učinkovitost', 'Optimizacija potrošnje na mobilnim uređajima.'],
]

// 19) Oblak, DevOps i kontejneri [naziv, opis]
const CLOUD = [
  ['Računarstvo u oblaku', 'Isporuka resursa kao usluge putem interneta.'],
  ['IaaS / PaaS / SaaS', 'Modeli usluga oblaka po razini apstrakcije.'],
  ['Amazon Web Services (AWS)', 'Vodeća platforma usluga u oblaku.'],
  ['Microsoft Azure', 'Microsoftova platforma oblaka.'],
  ['Google Cloud Platform', 'Googleova platforma oblaka.'],
  ['Kontejnerizacija', 'Izolacija aplikacija u lagane kontejnere.'],
  ['Orkestracija (Kubernetes)', 'Automatsko upravljanje kontejnerima.'],
  ['Infrastruktura kao kod', 'Definiranje infrastrukture deklarativnim kodom.'],
  ['CI/CD cjevovodi', 'Automatizirana izgradnja, test i isporuka.'],
  ['Promatranje (Observability)', 'Logovi, metrike i tragovi za uvid u sustav.'],
  ['Skalabilnost', 'Sposobnost rasta s opterećenjem.'],
  ['Visoka dostupnost', 'Otpornost na kvarove i kontinuitet usluge.'],
  ['Serverless (FaaS)', 'Izvođenje funkcija bez upravljanja poslužiteljima.'],
  ['Edge computing', 'Obrada bliže izvoru podataka.'],
]

// 20) UI i strojno učenje [naziv, opis]
const AI = [
  ['Strojno učenje', 'Sustavi koji uče iz podataka bez eksplicitnog programiranja.'],
  ['Duboko učenje', 'Neuronske mreže s mnogo slojeva.'],
  ['Neuronske mreže', 'Modeli inspirirani biološkim neuronima.'],
  ['Transformeri', 'Arhitektura pažnje koja pokreće moderne jezične modele.'],
  ['Veliki jezični modeli (LLM)', 'Modeli za razumijevanje i generiranje teksta.'],
  ['Ugrađivanja (Embeddings)', 'Vektorski prikazi značenja za pretragu i sličnost.'],
  ['Obrada prirodnog jezika', 'Razumijevanje i generiranje ljudskog jezika.'],
  ['Računalni vid', 'Razumijevanje slika i videa.'],
  ['Potkrepljeno učenje', 'Učenje kroz nagrade i kazne.'],
  ['Generativni AI', 'Stvaranje teksta, slika, koda i zvuka.'],
  ['AI asistenti za kod', 'Alati koji predlažu i pišu kod (npr. Copilot).'],
  ['Agentski sustavi', 'Autonomni agenti koji izvode zadatke s alatima.'],
  ['MLOps', 'Operacionalizacija modela strojnog učenja.'],
  ['Etika i pristranost AI-a', 'Pravednost, transparentnost i odgovornost.'],
  ['RAG (dohvatom proširena generacija)', 'Spajanje pretrage znanja s generativnim modelom.'],
]

// 21) Open source pokret [naziv, opis]
const OSS = [
  ['Slobodni softver', 'Sloboda korištenja, proučavanja, mijenjanja i dijeljenja.'],
  ['Open Source Initiative', 'Promicanje otvorenog koda i definicije OSI.'],
  ['Bazar nasuprot katedrale', 'Esej Erica Raymonda o modelima razvoja.'],
  ['GNU/Linux', 'Otvorena platforma koja pokreće svijet.'],
  ['Apache Software Foundation', 'Domaćin brojnih ključnih projekata.'],
  ['Linux Foundation', 'Podrška otvorenim infrastrukturnim projektima.'],
  ['Doprinosi zajednice', 'Pull requestovi, izvješća o greškama, dokumentacija.'],
  ['Upravljanje projektom (governance)', 'Modeli odlučivanja u otvorenim projektima.'],
  ['Održivost open sourcea', 'Financiranje i izgaranje održavatelja.'],
  ['Forkanje', 'Stvaranje neovisne grane projekta.'],
]

// 22) Licenciranje i standardi [naziv, opis]
const LICENSES = [
  ['GPL', 'Copyleft licenca koja zahtijeva dijeljenje izmjena.'],
  ['LGPL', 'Blaži copyleft za knjižnice.'],
  ['MIT licenca', 'Vrlo dopuštajuća, jednostavna licenca.'],
  ['Apache 2.0', 'Dopuštajuća licenca s patentnim odredbama.'],
  ['BSD licence', 'Dopuštajuće licence s minimalnim uvjetima.'],
  ['Mozilla Public License', 'Datotečno-bazirani copyleft.'],
  ['Creative Commons', 'Licence za sadržaj, ne samo kod.'],
  ['ISO standardi', 'Međunarodni standardi (npr. za jezike).'],
  ['IEEE standardi', 'Standardi za inženjerstvo i mreže.'],
  ['Semantičko verzioniranje', 'MAJOR.MINOR.PATCH pravila inačica.'],
]

// 23) Pojmovnik [pojam, definicija]
const GLOSSARY = [
  ['Apstrakcija', 'Skrivanje detalja radi jednostavnijeg modela.'],
  ['Enkapsulacija', 'Skrivanje unutarnjeg stanja iza sučelja.'],
  ['Nasljeđivanje', 'Preuzimanje svojstava i ponašanja nadtipa.'],
  ['Polimorfizam', 'Isti poziv, različito ponašanje ovisno o tipu.'],
  ['Rekurzija', 'Funkcija koja poziva samu sebe.'],
  ['Iteracija', 'Ponavljanje koraka petljom.'],
  ['Kompajliranje', 'Prijevod izvornog koda u strojni/međukod.'],
  ['Interpretiranje', 'Izvođenje koda bez prethodnog prevođenja.'],
  ['Otklanjanje grešaka (Debugging)', 'Pronalazak i ispravak grešaka.'],
  ['Refaktoriranje', 'Poboljšanje strukture koda bez promjene ponašanja.'],
  ['Tehnički dug', 'Trošak budućeg rada zbog brzih rješenja danas.'],
  ['Složenost (Big O)', 'Asimptotska mjera vremena/prostora algoritma.'],
  ['Konkurentnost', 'Više zadataka napreduje istodobno.'],
  ['Paralelizam', 'Istovremeno izvođenje na više procesora.'],
  ['Nepromjenjivost', 'Podaci se ne mijenjaju nakon stvaranja.'],
  ['Idempotentnost', 'Višestruko izvođenje daje isti rezultat.'],
  ['Race condition', 'Pogreška zbog redoslijeda istodobnih operacija.'],
  ['Deadlock', 'Uzajamno blokiranje procesa koji čekaju jedan drugog.'],
  ['Cache', 'Brza pohrana često korištenih podataka.'],
  ['API', 'Sučelje za komunikaciju među programima.'],
  ['SDK', 'Komplet alata za razvoj na nekoj platformi.'],
  ['Framework', 'Okvir koji nameće strukturu i pruža gradivne blokove.'],
  ['Knjižnica (Library)', 'Skup gotovih funkcija za ponovnu upotrebu.'],
  ['Middleware', 'Posrednički sloj između komponenti.'],
  ['Garbage collection', 'Automatsko oslobađanje neiskorištene memorije.'],
  ['Pokazivač (Pointer)', 'Varijabla koja sadrži adresu u memoriji.'],
  ['Niti (Threads)', 'Lagane jedinice izvođenja unutar procesa.'],
  ['Proces', 'Program u izvođenju s vlastitim resursima.'],
  ['Serijalizacija', 'Pretvorba objekta u prenosivi oblik.'],
  ['Determinizam', 'Isti ulaz uvijek daje isti izlaz.'],
  ['Spojivost (Coupling)', 'Stupanj međuovisnosti modula.'],
  ['Kohezija', 'Stupanj povezanosti unutar modula.'],
  ['DRY', 'Ne ponavljaj se — izbjegavanje duplikacije.'],
  ['KISS', 'Drži jednostavno — izbjegavanje nepotrebne složenosti.'],
  ['YAGNI', 'Ne dodavaj ono što ti (još) ne treba.'],
  ['SOLID', 'Pet principa objektno orijentiranog dizajna.'],
  ['Idempotentni API', 'Pozivi bez dodatnih nuspojava pri ponavljanju.'],
  ['Zastoj (Latency)', 'Vrijeme odgovora sustava.'],
  ['Propusnost (Throughput)', 'Količina obrađenog posla u jedinici vremena.'],
  ['Skalabilnost', 'Sposobnost rasta s opterećenjem.'],
]

// 24) Sadašnjost i trendovi (2020-e) [naziv, opis]
const TRENDS = [
  ['AI-native razvoj', 'Alati i tijekovi rada izgrađeni oko umjetne inteligencije.'],
  ['Platform engineering', 'Interne platforme koje ubrzavaju razvojne timove.'],
  ['WebAssembly izvan preglednika', 'Wasm kao prijenosno izvedbeno okruženje.'],
  ['Rust u sistemskom softveru', 'Sigurnost memorije u jezgrama i alatima.'],
  ['Edge i distribuirani sustavi', 'Obrada bliže korisnicima i uređajima.'],
  ['Zelena računarstvena održivost', 'Energetski učinkovit softver i infrastruktura.'],
  ['Low-code / No-code', 'Vizualna izrada aplikacija uz manje koda.'],
  ['Supply chain sigurnost', 'SBOM, potpisivanje artefakata, provjereni lanci.'],
  ['Razvojna iskustva (DevEx)', 'Mjerenje i poboljšanje produktivnosti razvojnih timova.'],
  ['Vektorske baze i RAG', 'Semantička pretraga znanja u aplikacijama.'],
  ['Observability 2.0', 'Strukturirani tragovi i analitika u stvarnom vremenu.'],
  ['Postkvantna kriptografija', 'Algoritmi otporni na kvantna računala.'],
]

// ───────────────────────────────────────────────────────────────────────────
//  IZGRADNJA STABLA
// ───────────────────────────────────────────────────────────────────────────

// Pretvori jednostavne podatke u podstabla
const fromTimeline = () => TIMELINE.map(([y, t, d]) =>
  N(`${y}. — ${t}`, { cat: 'fact', summary: d, kind: 'event', children: [
    N(`Godina: ${y}.`, { cat: 'fact' }),
    N(`Detalji: ${d}`, { cat: 'note', summary: d }),
  ] }))

const fromLangs = () => LANGS.map(([name, year, author, para, note]) =>
  N(`Jezik: ${name}`, { cat: 'concept', summary: `${name} (${year}) — ${note}`, kind: 'tech', children: [
    N(`Godina nastanka: ${year}.`, { cat: 'fact' }),
    N(`Tvorac: ${author}`, { cat: 'example' }),
    N(`Paradigma: ${para}`, { cat: 'definition' }),
    N(`Značaj: ${note}`, { cat: 'note', summary: note }),
  ] }))

const fromParadigms = () => PARADIGMS.map(([name, desc, ex]) =>
  N(`Paradigma: ${name}`, { cat: 'definition', summary: desc, kind: 'concept', children: [
    N(`Opis: ${desc}`, { cat: 'note', summary: desc }),
    N(`Primjeri: ${ex}`, { cat: 'example' }),
  ] }))

const fromPeople = () => PEOPLE.map(([name, years, contrib]) =>
  N(`Osoba: ${name}`, { cat: 'example', summary: `${name} (${years}) — ${contrib}`, kind: 'person', children: [
    N(`Razdoblje: ${years}`, { cat: 'fact' }),
    N(`Doprinos: ${contrib}`, { cat: 'note', summary: contrib }),
  ] }))

const fromCompanies = () => COMPANIES.map(([name, year, desc]) =>
  N(`Tvrtka: ${name}`, { cat: 'note', summary: `${name} (osn. ${year}) — ${desc}`, kind: 'org', children: [
    N(`Osnovana: ${year}.`, { cat: 'fact' }),
    N(`Doprinos: ${desc}`, { cat: 'note', summary: desc }),
  ] }))

const simplePair = (prefix, cat, kind) => ([a, b]) =>
  N(`${prefix}${a}`, { cat, summary: b, kind, children: [ N(`Opis: ${b}`, { cat: 'note', summary: b }) ] })

const tripleTech = (prefix, cat, kind) => ([a, b, c]) =>
  N(`${prefix}${a}`, { cat, summary: `${a} — ${c}`, kind, children: [
    N(`Vrsta/kategorija: ${b}`, { cat: 'definition' }),
    N(`Opis: ${c}`, { cat: 'note', summary: c }),
  ] })

// Glavne grane
const BRANCHES = [
  N('Vremenska crta (povijest)', { cat: 'fact', summary: 'Ključni događaji u povijesti softverskog inženjerstva.', children: fromTimeline() }),
  N('Programski jezici', { cat: 'concept', summary: 'Evolucija programskih jezika kroz desetljeća.', children: fromLangs() }),
  N('Paradigme programiranja', { cat: 'definition', summary: 'Glavni stilovi i pristupi programiranju.', children: fromParadigms() }),
  N('Pioniri i osobe', { cat: 'example', summary: 'Ljudi koji su oblikovali računarstvo i softver.', children: fromPeople() }),
  N('Tvrtke i organizacije', { cat: 'note', summary: 'Tvrtke i institucije s ključnim doprinosima.', children: fromCompanies() }),
  N('Operacijski sustavi', { cat: 'process', summary: 'Sustavi koji upravljaju računalnim resursima.', children: OS.map(tripleTech('OS: ', 'process', 'tech')) }),
  N('Baze podataka', { cat: 'process', summary: 'Tehnologije za pohranu i upite nad podacima.', children: DBS.map(tripleTech('Baza: ', 'process', 'tech')) }),
  N('Algoritmi', { cat: 'process', summary: 'Temeljni algoritmi softverskog inženjerstva.', children: ALGOS.map(tripleTech('Algoritam: ', 'process', 'concept')) }),
  N('Strukture podataka', { cat: 'definition', summary: 'Načini organiziranja podataka u memoriji.', children: DS.map(simplePair('Struktura: ', 'definition', 'concept')) }),
  N('Oblikovni obrasci', { cat: 'definition', summary: 'Provjerena rješenja za ponavljajuće probleme dizajna.', children: PATTERNS.map(tripleTech('Obrazac: ', 'definition', 'concept')) }),
  N('Arhitektura softvera', { cat: 'concept', summary: 'Načini strukturiranja velikih softverskih sustava.', children: ARCH.map(simplePair('Arhitektura: ', 'concept', 'concept')) }),
  N('Metodologije i procesi', { cat: 'process', summary: 'Pristupi organizaciji razvoja softvera.', children: METHODS.map(simplePair('Metodologija: ', 'process', 'concept')) }),
  N('Alati i ekosustav', { cat: 'note', summary: 'Alati za razvoj, izgradnju i isporuku softvera.', children: TOOLS.map(tripleTech('Alat: ', 'note', 'tech')) }),
  N('Mreže i protokoli', { cat: 'fact', summary: 'Protokoli i tehnologije koje povezuju sustave.', children: NET.map(simplePair('Protokol: ', 'fact', 'tech')) }),
  N('Sigurnost softvera', { cat: 'question', summary: 'Zaštita softvera i podataka od prijetnji.', children: SECURITY.map(simplePair('Sigurnost: ', 'question', 'concept')) }),
  N('Testiranje i kvaliteta', { cat: 'question', summary: 'Prakse za osiguranje kvalitete softvera.', children: TESTING.map(simplePair('Testiranje: ', 'question', 'concept')) }),
  N('Web tehnologije', { cat: 'concept', summary: 'Tehnologije za izgradnju weba.', children: WEB.map(simplePair('Web: ', 'concept', 'tech')) }),
  N('Mobilni i ugrađeni razvoj', { cat: 'concept', summary: 'Razvoj za mobilne i ugrađene uređaje.', children: MOBILE.map(simplePair('Mobilno: ', 'concept', 'tech')) }),
  N('Oblak, DevOps i kontejneri', { cat: 'process', summary: 'Suvremena isporuka i upravljanje softverom.', children: CLOUD.map(simplePair('Oblak: ', 'process', 'concept')) }),
  N('Umjetna inteligencija i strojno učenje', { cat: 'concept', summary: 'AI tehnologije koje mijenjaju softversko inženjerstvo.', children: AI.map(simplePair('AI: ', 'concept', 'concept')) }),
  N('Open source pokret', { cat: 'example', summary: 'Filozofija i praksa otvorenog koda.', children: OSS.map(simplePair('Open source: ', 'example', 'concept')) }),
  N('Licenciranje i standardi', { cat: 'note', summary: 'Pravni i normativni okvir softvera.', children: LICENSES.map(simplePair('Licenca/standard: ', 'note', 'concept')) }),
  N('Pojmovnik (koncepti)', { cat: 'definition', summary: 'Temeljni pojmovi softverskog inženjerstva.', children: GLOSSARY.map(simplePair('Pojam: ', 'definition', 'concept')) }),
  N('Sadašnjost i trendovi (2020-e)', { cat: 'question', summary: 'Smjerovi koji danas oblikuju struku.', children: TRENDS.map(simplePair('Trend: ', 'question', 'concept')) }),
]

const ROOT = N('Softversko inženjerstvo — povijest i sadašnjost', {
  cat: 'root',
  summary: 'Interaktivna mapa znanja o razvoju i današnjem stanju softverskog inženjerstva, na hrvatskom jeziku.',
  children: BRANCHES,
})

// ── Brojanje i strukturirano proširenje do točno TARGET čvorova ─────────────
function countNodes(node) {
  let c = 1
  if (node.children) for (const ch of node.children) c += countNodes(ch)
  return c
}

// Aspekti za proširenje, ovisno o vrsti entiteta (sve istinite, generičke
// pod-teme; ime roditelja ugrađeno je u svaki čvor pa nema duplikata).
const ASPECTS = {
  tech: [
    ['Povijesni kontekst', 'nastao je kao odgovor na potrebe svoga vremena i razvijao se kroz niz inačica.'],
    ['Ključne značajke', 'donosi prepoznatljiv skup mogućnosti koje su definirale njegovu upotrebu.'],
    ['Model dizajna', 'počiva na promišljenim odlukama o dizajnu i svjesnim kompromisima.'],
    ['Tipične primjene', 'koristi se u stvarnim sustavima gdje njegove prednosti najbolje dolaze do izražaja.'],
    ['Ekosustav i alati', 'okružen je alatima, knjižnicama i zajednicom koji ubrzavaju razvoj.'],
    ['Upravljanje ovisnostima', 'ima ustaljene načine dohvaćanja i upravljanja knjižnicama.'],
    ['Performanse', 'pokazuje karakteristične profile brzine i potrošnje resursa.'],
    ['Sigurnosni aspekti', 'donosi specifične sigurnosne odlike i rizike koje treba poznavati.'],
    ['Prednosti', 'nudi konkretne prednosti koje su pridonijele njegovu usvajanju.'],
    ['Ograničenja', 'ima kompromise i scenarije u kojima druga rješenja bolje odgovaraju.'],
    ['Utjecaj', 'ostavio je trag na kasnije tehnologije i prakse u struci.'],
    ['Suvremeni status', 'i danas ima jasnu ulogu u modernom softverskom inženjerstvu.'],
    ['Učenje i resursi', 'dostupna je bogata dokumentacija i materijali za učenje.'],
    ['Alternative', 'postoje srodne tehnologije koje rješavaju slične probleme na drugačiji način.'],
    ['Standardizacija', 'razvoj prati formalna ili de facto standardizacija.'],
    ['Zajednica i usvajanje', 'okuplja zajednicu koja oblikuje njegov daljnji razvoj.'],
    ['Integracija', 'dobro se uklapa u šire sustave i tijekove rada.'],
    ['Testiranje', 'postoje ustaljeni pristupi testiranju i osiguranju kvalitete.'],
    ['Otklanjanje grešaka', 'ima alate i tehnike za dijagnostiku problema.'],
    ['Verzioniranje', 'kroz inačice donosi nove mogućnosti uz brigu o kompatibilnosti.'],
    ['Najbolje prakse', 'zajednica je iznjedrila preporučene obrasce korištenja.'],
    ['Tipične zamke', 'postoje česte pogreške koje iskusni inženjeri izbjegavaju.'],
    ['Budući smjer', 'razvoj se nastavlja u skladu s potrebama industrije.'],
    ['Primjer iz prakse', 'najbolje se razumije kroz konkretan primjer primjene.'],
  ],
  concept: [
    ['Definicija', 'precizno opisuje ideju i njezino mjesto u softverskom inženjerstvu.'],
    ['Motivacija', 'odgovara na konkretan problem ili potrebu u razvoju softvera.'],
    ['Kako funkcionira', 'počiva na jasnom mehanizmu ili načelu rada.'],
    ['Primjer u praksi', 'najbolje se razumije kroz konkretan primjer primjene.'],
    ['Prednosti', 'donosi mjerljive koristi kada se primjenjuje ispravno.'],
    ['Nedostaci', 'ima ograničenja koja treba uzeti u obzir.'],
    ['Zamke i greške', 'česte su pogreške koje treba izbjegavati pri primjeni.'],
    ['Povezani pojmovi', 'usko je povezan s drugim idejama i tehnikama u struci.'],
    ['Povijest ideje', 'razvijao se kroz rad istraživača i praktičara tijekom godina.'],
    ['Suvremena upotreba', 'aktualan je i danas u modernim sustavima i timovima.'],
    ['Kada koristiti', 'postoje situacije u kojima je posebno prikladan.'],
    ['Kada izbjegavati', 'nije univerzalno rješenje i ima neprikladne kontekste.'],
    ['Složenost', 'nosi određenu cijenu u vremenu, prostoru ili kognitivnom opterećenju.'],
    ['Mjerenje i metrike', 'uspjeh primjene može se pratiti odgovarajućim metrikama.'],
    ['Utjecaj na kvalitetu', 'pravilna primjena poboljšava kvalitetu softvera.'],
    ['Alternativni pristupi', 'postoje druge tehnike koje rješavaju sličan problem.'],
    ['Primjena u timovima', 'oblikuje način na koji timovi surađuju i rade.'],
    ['Veza s arhitekturom', 'utječe na strukturu i odluke o arhitekturi sustava.'],
    ['Automatizacija', 'dijelovi se mogu automatizirati odgovarajućim alatima.'],
    ['Najbolje prakse', 'postoje preporučeni obrasci za uspješnu primjenu.'],
    ['Edukacija', 'važan je dio obrazovanja softverskih inženjera.'],
    ['Standardi i smjernice', 'vežu ga formalne ili neformalne smjernice struke.'],
    ['Budućnost', 'i dalje se razvija s napretkom tehnologije.'],
    ['Sažetak', 'ključna poruka koju vrijedi zapamtiti o ovoj temi.'],
  ],
  person: [
    ['Biografija', 'životni put oblikovao je doprinose računarstvu.'],
    ['Obrazovanje', 'formalni put doveo je do područja rada u računarstvu.'],
    ['Ključni doprinos', 'rad je trajno utjecao na razvoj softverskog inženjerstva.'],
    ['Glavna djela', 'iza imena stoje prepoznatljiva djela i ideje.'],
    ['Nagrade i priznanja', 'doprinosi su prepoznati u akademskoj i industrijskoj zajednici.'],
    ['Naslijeđe', 'ideje žive u alatima i praksama koje danas koristimo.'],
    ['Povezane osobe', 'surađivao/la je i utjecao/la na druge pionire struke.'],
    ['Citati i misli', 'ostavio/la je zapažene misli o struci.'],
    ['Utjecaj na obrazovanje', 'oblikovao/la je način na koji učimo računarstvo.'],
    ['Kontekst vremena', 'djelovao/la je u određenom tehnološkom razdoblju.'],
    ['Područja rada', 'bavio/la se prepoznatljivim područjima računarstva.'],
    ['Utjecaj na industriju', 'rad je promijenio praksu u industriji softvera.'],
    ['Daljnje čitanje', 'o životu i radu postoji opsežna literatura.'],
    ['Suradnje', 'surađivao/la je s institucijama i timovima.'],
    ['Anegdote', 'uz ime se vežu poznate priče iz struke.'],
    ['Sažetak doprinosa', 'ključna ostavština u jednoj rečenici.'],
  ],
  org: [
    ['Osnivanje', 'nastanak je vezan uz određeno vrijeme i viziju osnivača.'],
    ['Osnivači', 'iza nje stoje prepoznatljivi pojedinci.'],
    ['Ključni proizvodi', 'iza nje stoje proizvodi i tehnologije s velikim utjecajem.'],
    ['Tehnološki doprinos', 'pridonijela je temeljnim tehnologijama struke.'],
    ['Utjecaj na industriju', 'oblikovala je smjer razvoja softvera i tržišta.'],
    ['Doprinos open sourceu', 'pridonijela je otvorenim tehnologijama i standardima.'],
    ['Istraživanje i razvoj', 'ulagala je u istraživanje i inovacije.'],
    ['Kultura i praksa', 'iznjedrila je prepoznatljive radne prakse.'],
    ['Kontroverze', 'kroz povijest je imala i sporne trenutke.'],
    ['Današnji status', 'i danas ima ulogu u ekosustavu softverskog inženjerstva.'],
    ['Akvizicije i partnerstva', 'rasla je kroz suradnje i preuzimanja.'],
    ['Standardi', 'sudjelovala je u oblikovanju standarda.'],
    ['Utjecaj na zajednicu', 'oblikovala je zajednicu razvojnih inženjera.'],
    ['Naslijeđe', 'ostavila je trajan trag u struci.'],
    ['Ljudi', 'okupljala je utjecajne inženjere i istraživače.'],
    ['Sažetak', 'ključna uloga u jednoj rečenici.'],
  ],
  event: [
    ['Kontekst', 'dogodio se u određenom tehnološkom i društvenom trenutku.'],
    ['Značaj', 'označava prekretnicu u razvoju struke.'],
    ['Posljedice', 'utjecao je na sve što je uslijedilo u softverskom inženjerstvu.'],
    ['Sudionici', 'uz njega se vežu prepoznatljivi akteri.'],
    ['Pozadina', 'prethodili su mu određeni uvjeti i potrebe.'],
    ['Reakcije', 'izazvao je odjek u struci i šire.'],
    ['Dugoročni utjecaj', 'njegove posljedice osjećaju se i danas.'],
    ['Povezani događaji', 'dio je šireg niza prekretnica.'],
    ['Pouke', 'iz njega struka izvlači trajne pouke.'],
    ['Sažetak', 'ključna poruka u jednoj rečenici.'],
  ],
}

// Skupi sve "expandable" čvorove (oni s definiranim kind) po dubini
function collectExpandable(node, parentName, out) {
  if (node.kind && ASPECTS[node.kind]) {
    out.push({ node, parentName })
  }
  if (node.children) for (const ch of node.children) collectExpandable(ch, node.label, out)
  return out
}

function entityName(label) {
  // "Jezik: Python" -> "Python"; "Osoba: Alan Turing" -> "Alan Turing"
  const idx = label.indexOf(': ')
  return idx >= 0 ? label.slice(idx + 2) : label
}

function expandToTarget() {
  let total = countNodes(ROOT)
  const expandable = collectExpandable(ROOT, null, [])
  // Round-robin: svakom entitetu dodaj sljedeći aspekt dok ne dosegnemo cilj.
  let round = 0
  let progressed = true
  while (total < TARGET && progressed) {
    progressed = false
    for (const { node } of expandable) {
      if (total >= TARGET) break
      const aspects = ASPECTS[node.kind]
      if (round >= aspects.length) continue
      const [title, tail] = aspects[round]
      const name = entityName(node.label)
      const summary = `${name} ${tail}`
      node.children.push(N(`${title}: ${name}`, { cat: node.cat === 'root' ? 'note' : node.cat, summary }))
      total++
      progressed = true
    }
    round++
  }
  return total
}

const finalCount = expandToTarget()
if (finalCount !== TARGET) {
  console.warn(`⚠ Dosegnuto ${finalCount} čvorova (cilj ${TARGET}). Prilagodi datasete.`)
}

// ───────────────────────────────────────────────────────────────────────────
//  RASPORED (radijalni) + STIL + SERIJALIZACIJA
// ───────────────────────────────────────────────────────────────────────────

// 1) Izračun broja listova po podstablu (za kutnu raspodjelu sektora)
function computeLeaves(node) {
  if (!node.children || node.children.length === 0) { node._leaves = 1; return 1 }
  let s = 0
  for (const ch of node.children) s += computeLeaves(ch)
  node._leaves = s
  return s
}
computeLeaves(ROOT)

// 2) Maksimalna dubina
function computeDepth(node, d = 0) {
  node._depth = d
  let max = d
  if (node.children) for (const ch of node.children) max = Math.max(max, computeDepth(ch, d + 1))
  return max
}
const MAX_DEPTH = computeDepth(ROOT)

const L = ROOT._leaves
const MIN_ARC = 90 // ciljani kružni razmak po listu (px)
const RING_STEP = Math.max(1400, (L * MIN_ARC) / (2 * Math.PI * MAX_DEPTH))

// 3) Dodjela kuta po sektorima i pozicija
function layout(node, a0, a1) {
  const angle = (a0 + a1) / 2
  const r = node._depth * RING_STEP
  node._x = Math.round(Math.cos(angle) * r)
  node._y = Math.round(Math.sin(angle) * r)
  if (node.children && node.children.length) {
    let a = a0
    const span = a1 - a0
    for (const ch of node.children) {
      const frac = ch._leaves / node._leaves
      const cA0 = a
      const cA1 = a + span * frac
      layout(ch, cA0, cA1)
      a = cA1
    }
  }
}
layout(ROOT, 0, 2 * Math.PI)

// 4) Stil po dubini
function styleFor(node) {
  const d = node._depth
  const color = CAT[node.cat] || CAT.note
  if (d === 0) {
    return { shape: 'pill', fillColor: '#04201E', borderColor: color, borderWidth: 3,
      textColor: '#FAFAFA', fontSize: 30, fontWeight: 800, shadowEnabled: true, glowEnabled: true }
  }
  if (d === 1) {
    return { shape: 'rounded', fillColor: '#141416', borderColor: color, borderWidth: 2.5,
      textColor: '#FAFAFA', fontSize: 20, fontWeight: 700, shadowEnabled: true, glowEnabled: false }
  }
  if (d === 2) {
    return { shape: 'rounded', fillColor: '#111113', borderColor: color, borderWidth: 1.75,
      textColor: '#FAFAFA', fontSize: 15, fontWeight: 600, shadowEnabled: true, glowEnabled: false }
  }
  return { shape: 'rectangle', fillColor: '#0D0D0F', borderColor: '#27272A', borderWidth: 1,
    textColor: '#D4D4D8', fontSize: 12, fontWeight: 500, shadowEnabled: false, glowEnabled: false }
}

function sizeFor(node) {
  const d = node._depth
  const len = node.label.length
  const fs = d === 0 ? 30 : d === 1 ? 20 : d === 2 ? 15 : 12
  const w = Math.min(560, Math.max(d <= 1 ? 200 : 130, Math.round(len * fs * 0.62) + 36))
  const h = d === 0 ? 92 : d === 1 ? 60 : d === 2 ? 46 : 36
  return { width: w, height: h }
}

// 5) Serijalizacija u DBNode/DBEdge
const baseTime = Date.now()
const nodes = []
const edges = []
let nodeSeq = 0
let edgeSeq = 0

function serialize(node, parentDbId) {
  const id = nid()
  const t = baseTime + nodeSeq
  nodeSeq++
  const dbNode = {
    id,
    type: 'text',
    position: { x: node._x, y: node._y },
    size: sizeFor(node),
    content: node.label,
    style: styleFor(node),
    parentId: parentDbId,
    isRoot: node._depth === 0,
    metadata: {
      category: node.cat,
      ai: { generatedBy: 'generate', inferredCategory: node.cat },
      ...(node.summary ? { description: { summary: node.summary, generatedAt: t } } : {}),
    },
    createdAt: t,
    updatedAt: t,
  }
  if (!parentDbId) delete dbNode.parentId
  nodes.push(dbNode)

  if (parentDbId) {
    const d = node._depth
    edges.push({
      id: 'e' + (edgeSeq++).toString(36),
      sourceId: parentDbId,
      targetId: id,
      style: {
        type: 'bezier',
        strokeColor: d <= 1 ? (CAT[node.cat] || '#3A3A40') : '#26262B',
        strokeWidth: Math.max(0.6, 2.6 - d * 0.6),
        arrowStart: 'none',
        arrowEnd: 'none',
        animated: false,
      },
      createdAt: t,
      updatedAt: t,
    })
  }

  if (node.children) for (const ch of node.children) serialize(ch, id)
  return id
}

const rootId = serialize(ROOT, null)

// 6) Kamera — uokviri korijen, malen zoom za pregled cijele galaksije
const camera = { x: 0, y: 0, zoom: 0.045 }

const doc = {
  id: 'se-povijest-10k-' + baseTime.toString(36),
  title: 'Softversko inženjerstvo — povijest i sadašnjost (10k)',
  nodes,
  edges,
  camera,
  rootNodeId: rootId,
  settings: {
    gridEnabled: true,
    gridSize: 32,
    snapToGrid: false,
    backgroundColor: '#0D0D0F',
    defaultNodeStyle: {
      shape: 'rounded', fillColor: '#111113', borderColor: '#27272A', borderWidth: 1.5,
      textColor: '#FAFAFA', fontSize: 14, fontWeight: 500, shadowEnabled: true, glowEnabled: false,
    },
    defaultEdgeStyle: {
      type: 'bezier', strokeColor: '#2A2A30', strokeWidth: 2, arrowStart: 'none', arrowEnd: 'arrow', animated: false,
    },
  },
  createdAt: baseTime,
  updatedAt: baseTime,
  tags: ['povijest', 'softversko-inženjerstvo', 'hrvatski', '10k'],
}

writeFileSync(OUT, JSON.stringify(doc))

// 7) Sažetak u konzolu
console.log('✓ Generirano:')
console.log('  čvorova:', nodes.length)
console.log('  bridova:', edges.length)
console.log('  grana (1. razina):', BRANCHES.length)
console.log('  max dubina:', MAX_DEPTH)
console.log('  RING_STEP:', Math.round(RING_STEP), 'px')
console.log('  datoteka:', OUT)
const bytes = Buffer.byteLength(JSON.stringify(doc))
console.log('  veličina:', (bytes / 1024 / 1024).toFixed(2), 'MB')
