// scripts/generate-tech-history-map.mjs
//
// Generira NeuroCanvas mapu (.json) o povijesti i sadašnjosti TEHNOLOGIJE i
// inženjerstva — na hrvatskom jeziku — s točno 20 000 čvorova.
//
// Tema (različita od softverskog inženjerstva): računalni hardver, čipovi,
// internet i mreže, umjetna inteligencija, robotika, svemir, telekomunikacije,
// elektronika, energetika, kvantno računarstvo, kibernetička sigurnost,
// mobilni uređaji, audio/video, transport, biotehnologija, materijali,
// pohrana, igre, AR/VR, IoT, blockchain, senzori + izumitelji i tvrtke.
//
// Format izlaza odgovara DBMapDocument / parseMapJson (app/utils/mapImport.ts).
//
// Pokretanje:  node scripts/generate-tech-history-map.mjs
// Izlaz:       tehnologija-povijest-i-danas-20k.json  (korijen repo-a)

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Broj čvorova preko CLI-a: `node scripts/generate-tech-history-map.mjs 10000` (zadano 10000).
// App pouzdano učitava ~10k čvorova; veće mape blokiraju glavnu dretvu pri učitavanju.
const TARGET = Number(process.argv[2]) || 10000
const SIZE_LABEL = Math.round(TARGET / 1000) + 'k'
const OUT = join(__dirname, '..', `tehnologija-povijest-i-danas-${SIZE_LABEL}.json`)

// ── Kategorije (boje iz app/constants/categories.ts) ───────────────────────
const CAT = {
  root: '#00D2BE', concept: '#60A5FA', fact: '#4ADE80', question: '#FACC15',
  example: '#FB923C', definition: '#A78BFA', process: '#F472B6', note: '#71717A',
}

let _uid = 0
const nid = () => 't' + (_uid++).toString(36)
const N = (label, opts = {}) => ({ label, ...opts })

// ───────────────────────────────────────────────────────────────────────────
//  KURIRANI PODACI (stvarne činjenice)
// ───────────────────────────────────────────────────────────────────────────

// Vremenska crta tehnologije [godina, naslov, opis]
const TIMELINE = [
  ['oko 3300 pr. Kr.', 'Kotač', 'Izum kotača u Mezopotamiji mijenja transport i mehaniku.'],
  ['oko 1450', 'Tiskarski stroj', 'Johannes Gutenberg uvodi tisak pomičnim slovima i širi pismenost.'],
  ['1712', 'Parni stroj', 'Newcomen i kasnije Watt pokreću industrijsku revoluciju.'],
  ['1800', 'Električna baterija', 'Alessandro Volta izrađuje prvu kemijsku bateriju (voltin stup).'],
  ['1837', 'Telegraf', 'Samuel Morse i suradnici omogućuju brzu komunikaciju na daljinu.'],
  ['1876', 'Telefon', 'Alexander Graham Bell patentira telefon.'],
  ['1879', 'Žarulja sa žarnom niti', 'Thomas Edison komercijalizira praktičnu električnu žarulju.'],
  ['1888', 'Izmjenična struja', 'Nikola Tesla razvija sustav izmjenične struje i indukcijski motor.'],
  ['1895', 'Radio i X-zrake', 'Marconi razvija bežični telegraf; Röntgen otkriva X-zrake.'],
  ['1903', 'Motorni let', 'Braća Wright izvode prvi kontrolirani let zrakoplovom.'],
  ['1947', 'Tranzistor', 'Bell Labs (Bardeen, Brattain, Shockley) izumljuje tranzistor.'],
  ['1957', 'Sputnik 1', 'SSSR lansira prvi umjetni satelit i započinje svemirsku utrku.'],
  ['1958', 'Integrirani sklop', 'Jack Kilby i Robert Noyce stvaraju integrirani sklop (čip).'],
  ['1960', 'Laser', 'Theodore Maiman demonstrira prvi funkcionalni laser.'],
  ['1961', 'Čovjek u svemiru', 'Jurij Gagarin postaje prvi čovjek u orbiti.'],
  ['1969', 'Slijetanje na Mjesec', 'Misija Apollo 11 dovodi prve ljude na Mjesec.'],
  ['1971', 'Mikroprocesor', 'Intel 4004 — prvi komercijalni mikroprocesor.'],
  ['1973', 'Mobilni telefon', 'Motorola demonstrira prvi ručni mobilni telefon.'],
  ['1977', 'Voyager sonde', 'NASA lansira Voyager 1 i 2 prema vanjskim planetima.'],
  ['1981', 'IBM PC', 'IBM-ovo osobno računalo standardizira tržište.'],
  ['1983', 'Internet (TCP/IP)', 'ARPANET prelazi na TCP/IP — rođenje modernog interneta.'],
  ['1989', 'World Wide Web', 'Tim Berners-Lee u CERN-u stvara Web.'],
  ['1990', 'Svemirski teleskop Hubble', 'Lansiran teleskop koji mijenja astronomiju.'],
  ['1991', 'GSM mobilna mreža', 'Pokreće se digitalna mobilna telefonija (2G).'],
  ['1997', 'Roveri na Marsu', 'Mars Pathfinder spušta prvi rover Sojourner.'],
  ['1998', 'Međunarodna svemirska postaja', 'Počinje montaža ISS-a u orbiti.'],
  ['2007', 'Pametni telefon', 'Apple iPhone redefinira mobilne uređaje.'],
  ['2008', 'Bitcoin', 'Satoshi Nakamoto objavljuje rad o decentraliziranoj valuti.'],
  ['2012', 'Duboko učenje (AlexNet)', 'Neuronske mreže nadmašuju klasične metode u prepoznavanju slika.'],
  ['2015', 'Povratak raketa', 'SpaceX uspješno slijeće prvi stupanj rakete Falcon 9.'],
  ['2017', 'Transformeri', 'Arhitektura pažnje pokreće modernu eru umjetne inteligencije.'],
  ['2019', 'Kvantna nadmoć', 'Google tvrdi da je kvantno računalo nadmašilo klasično u zadatku.'],
  ['2021', 'James Webb teleskop', 'Lansiran najsnažniji svemirski teleskop dosad.'],
  ['2022', 'Generativni AI', 'Generativni modeli teksta i slika ulaze u širu upotrebu.'],
  ['2023', 'Komercijalni let na Mjesec', 'Niz misija najavljuje novu eru istraživanja Mjeseca.'],
]

// Računalni hardver [naziv, opis]
const HARDWARE = [
  ['Procesor (CPU)', 'Središnja jedinica koja izvršava instrukcije programa.'],
  ['Grafički procesor (GPU)', 'Paralelni procesor za grafiku i ubrzanje računanja.'],
  ['Matična ploča', 'Glavna ploča koja povezuje sve komponente računala.'],
  ['Radna memorija (RAM)', 'Brza privremena memorija za podatke u obradi.'],
  ['Tvrdi disk (HDD)', 'Magnetska pohrana podataka velikog kapaciteta.'],
  ['SSD disk', 'Brza pohrana bez pokretnih dijelova (flash memorija).'],
  ['Napajanje (PSU)', 'Pretvara mrežni napon u napon za komponente.'],
  ['Hladnjak i ventilatori', 'Odvode toplinu i održavaju radne temperature.'],
  ['Mrežna kartica', 'Omogućuje povezivanje na mreže i internet.'],
  ['Zvučna kartica', 'Obrađuje audio ulaz i izlaz.'],
  ['BIOS / UEFI', 'Niskorazinski firmware koji pokreće računalo.'],
  ['Sabirnica (PCIe)', 'Brza veza za proširenja i kartice.'],
  ['Predmemorija (Cache)', 'Vrlo brza memorija unutar procesora.'],
  ['Tipkovnica i miš', 'Osnovni ulazni uređaji.'],
  ['Monitor', 'Izlazni uređaj koji prikazuje sliku.'],
  ['FPGA', 'Programabilni logički sklop prilagodljiv namjeni.'],
  ['ASIC', 'Sklop izrađen za specifičnu primjenu.'],
  ['Mikrokontroler', 'Računalo na čipu za ugrađene sustave.'],
  ['Pisač (3D i klasični)', 'Uređaji za izradu fizičkih ispisa i objekata.'],
  ['Skener', 'Pretvara fizičke dokumente u digitalni oblik.'],
]

// Mikroprocesori i čipovi [naziv, godina, proizvođač, opis]
const CHIPS = [
  ['Intel 4004', '1971', 'Intel', 'Prvi komercijalni mikroprocesor (4-bitni).'],
  ['Intel 8080', '1974', 'Intel', '8-bitni procesor koji pokreće rana mikroračunala.'],
  ['MOS 6502', '1975', 'MOS Technology', 'Jeftin procesor u Apple II, Commodore i NES-u.'],
  ['Zilog Z80', '1976', 'Zilog', 'Popularan 8-bitni procesor 1970-ih i 1980-ih.'],
  ['Intel 8086', '1978', 'Intel', 'Začetnik x86 arhitekture.'],
  ['Motorola 68000', '1979', 'Motorola', 'Pokreće rane Mac, Amiga i Atari ST.'],
  ['Intel 80386', '1985', 'Intel', 'Prvi 32-bitni x86 procesor.'],
  ['ARM1', '1985', 'Acorn', 'Začetak energetski učinkovite ARM arhitekture.'],
  ['Intel Pentium', '1993', 'Intel', 'Superskalarni procesor masovne upotrebe.'],
  ['NVIDIA GeForce 256', '1999', 'NVIDIA', 'Prozvan prvim GPU-om s hardverskom transformacijom.'],
  ['AMD Athlon', '1999', 'AMD', 'Konkurent Intelu u eri gigaherca.'],
  ['Intel Core 2', '2006', 'Intel', 'Višejezgreni procesori za masovno tržište.'],
  ['Qualcomm Snapdragon', '2007', 'Qualcomm', 'Sustav-na-čipu za pametne telefone.'],
  ['NVIDIA CUDA', '2007', 'NVIDIA', 'Platforma za računanje opće namjene na GPU-u.'],
  ['Apple A4', '2010', 'Apple', 'Prvi Appleov vlastiti mobilni SoC.'],
  ['Google TPU', '2016', 'Google', 'Čip namijenjen ubrzanju strojnog učenja.'],
  ['AMD Ryzen', '2017', 'AMD', 'Arhitektura Zen vraća AMD u vrh.'],
  ['Apple M1', '2020', 'Apple', 'ARM SoC za računala s velikom učinkovitošću.'],
  ['Apple M2', '2022', 'Apple', 'Nasljednik M1 s boljim performansama.'],
  ['NVIDIA H100', '2022', 'NVIDIA', 'GPU za treniranje velikih AI modela.'],
  ['Transputer', '1984', 'Inmos', 'Procesor dizajniran za paralelno računanje.'],
  ['Intel Itanium', '2001', 'Intel', 'Pokušaj 64-bitne arhitekture za poslužitelje.'],
  ['IBM Power', '1990', 'IBM', 'RISC procesori za poslužitelje i superračunala.'],
  ['SPARC', '1987', 'Sun Microsystems', 'RISC arhitektura za radne stanice.'],
  ['RISC-V', '2010', 'UC Berkeley', 'Otvorena arhitektura skupa instrukcija.'],
]

// Internet i mreže [naziv, opis]
const INTERNET = [
  ['ARPANET', 'Preteča interneta financirana od strane ARPA-e.'],
  ['Komutacija paketa', 'Slanje podataka u paketima, temelj interneta.'],
  ['TCP/IP', 'Skup protokola koji povezuje mreže u internet.'],
  ['DNS', 'Sustav imena domena — imena umjesto IP adresa.'],
  ['Ethernet', 'Dominantna tehnologija lokalnih mreža.'],
  ['Wi-Fi', 'Bežično lokalno umrežavanje.'],
  ['Usmjerivač (Router)', 'Uređaj koji usmjerava promet među mrežama.'],
  ['Preklopnik (Switch)', 'Povezuje uređaje unutar lokalne mreže.'],
  ['Optička vlakna', 'Prijenos podataka svjetlošću velikom brzinom.'],
  ['Web preglednik', 'Program za pristup web sadržaju.'],
  ['HTTP/HTTPS', 'Protokoli za prijenos web sadržaja.'],
  ['Pretraživači', 'Sustavi za pronalazak informacija na webu.'],
  ['Računarstvo u oblaku', 'Resursi kao usluga putem interneta.'],
  ['Sadržajne mreže (CDN)', 'Distribucija sadržaja bliže korisnicima.'],
  ['VPN', 'Sigurni privatni tuneli kroz javnu mrežu.'],
  ['IPv6', 'Novi adresni prostor interneta.'],
  ['Društvene mreže', 'Platforme za povezivanje i dijeljenje.'],
  ['Strujanje (Streaming)', 'Isporuka videa i zvuka u stvarnom vremenu.'],
  ['Submarinski kabeli', 'Podmorski kabeli koji povezuju kontinente.'],
  ['Satelitski internet', 'Pristup mreži putem satelita (npr. Starlink).'],
]

// Umjetna inteligencija [naziv, opis]
const AI = [
  ['Strojno učenje', 'Sustavi koji uče iz podataka.'],
  ['Duboko učenje', 'Neuronske mreže s mnogo slojeva.'],
  ['Neuronske mreže', 'Modeli inspirirani biološkim neuronima.'],
  ['Konvolucijske mreže (CNN)', 'Mreže za obradu slika.'],
  ['Rekurentne mreže (RNN)', 'Mreže za sekvencijalne podatke.'],
  ['Transformeri', 'Arhitektura pažnje za jezik i više.'],
  ['Veliki jezični modeli', 'Modeli za razumijevanje i generiranje teksta.'],
  ['Računalni vid', 'Razumijevanje slika i videa.'],
  ['Obrada prirodnog jezika', 'Rad s ljudskim jezikom.'],
  ['Prepoznavanje govora', 'Pretvorba govora u tekst.'],
  ['Generativni AI', 'Stvaranje teksta, slika, zvuka i koda.'],
  ['Potkrepljeno učenje', 'Učenje kroz nagrade i kazne.'],
  ['Ekspertni sustavi', 'Rani AI temeljen na pravilima.'],
  ['Pretraga i planiranje', 'Algoritmi za donošenje odluka.'],
  ['Robotska percepcija', 'AI koji omogućuje robotima da vide i razumiju.'],
  ['Autonomna vozila', 'Vozila vođena umjetnom inteligencijom.'],
  ['Preporučni sustavi', 'Predviđanje korisničkih preferencija.'],
  ['Etika umjetne inteligencije', 'Pravednost, sigurnost i odgovornost.'],
  ['MLOps', 'Operacionalizacija modela strojnog učenja.'],
  ['Ugrađivanja (Embeddings)', 'Vektorski prikazi značenja.'],
  ['Agentski sustavi', 'Autonomni agenti koji koriste alate.'],
  ['Strojno prevođenje', 'Automatski prijevod među jezicima.'],
]

// Robotika [naziv, opis]
const ROBOTICS = [
  ['Industrijski roboti', 'Robotske ruke u proizvodnji i montaži.'],
  ['Servomotori', 'Precizni motori za pokretanje robota.'],
  ['Aktuatori', 'Komponente koje pretvaraju energiju u kretanje.'],
  ['Senzori dodira', 'Omogućuju robotima osjet sile i kontakta.'],
  ['Računalni vid u robotici', 'Prepoznavanje okoline kamerama.'],
  ['Humanoidni roboti', 'Roboti nalik čovjeku.'],
  ['Roboti za suradnju (koboti)', 'Roboti koji rade uz ljude.'],
  ['Autonomna navigacija', 'Kretanje robota bez ljudskog upravljanja.'],
  ['Dronovi', 'Letjelice bez posade.'],
  ['Robotska kirurgija', 'Precizni roboti u medicini.'],
  ['SLAM', 'Istovremena lokalizacija i mapiranje prostora.'],
  ['Robotske ruke', 'Manipulatori s više stupnjeva slobode.'],
  ['Roj robota', 'Koordinirano djelovanje mnoštva malih robota.'],
  ['Eksoskeleti', 'Nosivi roboti koji pojačavaju ljudsku snagu.'],
  ['Robotika u skladištima', 'Automatizacija logistike i pakiranja.'],
  ['Podvodni roboti (ROV)', 'Daljinski upravljani podvodni uređaji.'],
  ['Planetarni roveri', 'Roboti za istraživanje drugih svjetova.'],
  ['Pogonski sustavi', 'Kotači, gusjenice i noge za kretanje.'],
  ['Upravljačka petlja', 'Povratna sprega za stabilno upravljanje.'],
  ['Strojna percepcija', 'Spajanje senzora u razumijevanje okoline.'],
]

// Svemirska tehnologija [naziv, godina, agencija/akter, opis]
const SPACE = [
  ['Sputnik 1', '1957', 'SSSR', 'Prvi umjetni satelit u orbiti.'],
  ['Explorer 1', '1958', 'SAD', 'Prvi američki satelit; otkrio Van Allenove pojaseve.'],
  ['Vostok 1', '1961', 'SSSR', 'Jurij Gagarin — prvi čovjek u svemiru.'],
  ['Apollo 11', '1969', 'NASA', 'Prvo ljudsko slijetanje na Mjesec.'],
  ['Sojuz', '1967', 'SSSR/Rusija', 'Dugovječna serija letjelica s posadom.'],
  ['Space Shuttle', '1981', 'NASA', 'Prva djelomično ponovno upotrebljiva letjelica.'],
  ['Hubble', '1990', 'NASA/ESA', 'Svemirski teleskop koji je promijenio astronomiju.'],
  ['Voyager 1 i 2', '1977', 'NASA', 'Sonde koje su napustile Sunčev sustav.'],
  ['Cassini–Huygens', '1997', 'NASA/ESA/ASI', 'Istraživanje Saturna i njegovih mjeseci.'],
  ['Mars Pathfinder', '1997', 'NASA', 'Prvi uspješni rover na Marsu (Sojourner).'],
  ['ISS', '1998', 'međunarodna', 'Stalna ljudska prisutnost u orbiti.'],
  ['Spirit i Opportunity', '2004', 'NASA', 'Roveri koji su nadmašili očekivani vijek.'],
  ['New Horizons', '2006', 'NASA', 'Prolet pokraj Plutona 2015.'],
  ['Falcon 1', '2008', 'SpaceX', 'Prva privatna raketa u orbiti.'],
  ['Falcon 9', '2010', 'SpaceX', 'Raketa s ponovno upotrebljivim prvim stupnjem.'],
  ['Dragon', '2010', 'SpaceX', 'Komercijalna letjelica za teret i posadu.'],
  ['Curiosity', '2011', 'NASA', 'Rover s nuklearnim napajanjem na Marsu.'],
  ['GPS', '1978', 'SAD', 'Globalni sustav za navigaciju i pozicioniranje.'],
  ['Galileo', '2011', 'ESA/EU', 'Europski navigacijski satelitski sustav.'],
  ['Perseverance', '2020', 'NASA', 'Rover koji prikuplja uzorke s Marsa.'],
  ['Ingenuity', '2021', 'NASA', 'Prvi helikopter koji je letio na Marsu.'],
  ['James Webb', '2021', 'NASA/ESA/CSA', 'Infracrveni teleskop iznimne osjetljivosti.'],
  ['Starlink', '2019', 'SpaceX', 'Konstelacija satelita za internet.'],
  ['Starship', '2023', 'SpaceX', 'Potpuno ponovno upotrebljiv sustav za teške terete.'],
  ['Artemis', '2022', 'NASA', 'Program povratka ljudi na Mjesec.'],
  ['Tiangong', '2021', 'Kina', 'Kineska svemirska postaja.'],
  ['Chang\'e', '2007', 'Kina', 'Serija misija na Mjesec, uključujući daljnju stranu.'],
  ['Rosetta', '2004', 'ESA', 'Prvo slijetanje na jezgru kometa (Philae).'],
  ['Juno', '2011', 'NASA', 'Istraživanje Jupitera iz orbite.'],
  ['Kepler', '2009', 'NASA', 'Teleskop za otkrivanje egzoplaneta.'],
]

// Telekomunikacije [naziv, opis]
const TELECOM = [
  ['Telegraf', 'Prijenos poruka električnim signalima.'],
  ['Telefon', 'Prijenos glasa na daljinu.'],
  ['Radio', 'Bežični prijenos zvuka.'],
  ['Televizija', 'Prijenos pokretne slike i zvuka.'],
  ['1G mreže', 'Prva generacija analogne mobilne telefonije.'],
  ['2G / GSM', 'Digitalna mobilna telefonija i SMS.'],
  ['3G', 'Mobilni internet i video pozivi.'],
  ['4G / LTE', 'Brzi mobilni širokopojasni pristup.'],
  ['5G', 'Vrlo niska latencija i velika propusnost.'],
  ['Satelitska komunikacija', 'Prijenos signala putem satelita.'],
  ['Optičke mreže', 'Prijenos podataka svjetlošću.'],
  ['Modem', 'Modulacija i demodulacija signala.'],
  ['Bazne stanice', 'Antene koje povezuju mobilne uređaje.'],
  ['VoIP', 'Glasovni pozivi preko internetskog protokola.'],
  ['Komutacija krugova', 'Klasično povezivanje telefonskih linija.'],
  ['Spektar i frekvencije', 'Upravljanje radiofrekvencijskim resursima.'],
  ['Antene', 'Pretvaraju električne signale u radiovalove.'],
  ['Mikrovalne veze', 'Bežični prijenos na velike udaljenosti.'],
  ['Mreža za hitne slučajeve', 'Pouzdane komunikacije u kriznim situacijama.'],
  ['Frekvencijsko skakanje', 'Tehnika otporna na smetnje (Hedy Lamarr).'],
]

// Elektronika i komponente [naziv, opis]
const ELECTRONICS = [
  ['Otpornik', 'Komponenta koja ograničava struju.'],
  ['Kondenzator', 'Pohranjuje električni naboj.'],
  ['Zavojnica (induktor)', 'Pohranjuje energiju u magnetskom polju.'],
  ['Dioda', 'Propušta struju samo u jednom smjeru.'],
  ['Tranzistor', 'Pojačava i prebacuje signale; temelj elektronike.'],
  ['Integrirani sklop', 'Mnoštvo komponenti na jednom čipu.'],
  ['LED dioda', 'Svjetleća dioda visoke učinkovitosti.'],
  ['Operacijsko pojačalo', 'Univerzalni gradivni blok analogne elektronike.'],
  ['Logička vrata', 'Osnovne jedinice digitalne logike.'],
  ['Tiskana pločica (PCB)', 'Nosač i povezivanje komponenti.'],
  ['Oscilator', 'Generira periodičke signale.'],
  ['Senzor', 'Pretvara fizičku veličinu u signal.'],
  ['Pretvarač (ADC/DAC)', 'Pretvorba analognog i digitalnog signala.'],
  ['Napajanje i regulatori', 'Stabiliziraju napon u sklopovima.'],
  ['Releji', 'Električki upravljane sklopke.'],
  ['Kristalni oscilator', 'Precizni izvor takta.'],
  ['MOSFET', 'Tranzistor ključan u digitalnim sklopovima.'],
  ['Tiristor', 'Snažna sklopka u energetskoj elektronici.'],
  ['Vakuumska cijev', 'Preteča tranzistora u ranoj elektronici.'],
  ['Mikroelektromehanika (MEMS)', 'Sićušni senzori i aktuatori na čipu.'],
]

// Energetika i obnovljivi izvori [naziv, opis]
const ENERGY = [
  ['Solarna energija', 'Pretvorba sunčeve svjetlosti u struju.'],
  ['Vjetroelektrane', 'Pretvorba energije vjetra u struju.'],
  ['Hidroelektrane', 'Energija vode za proizvodnju struje.'],
  ['Nuklearna energija', 'Energija fisije atomskih jezgri.'],
  ['Nuklearna fuzija', 'Spajanje jezgri — izvor energije budućnosti.'],
  ['Baterije (litij-ionske)', 'Pohrana energije za uređaje i vozila.'],
  ['Gorive ćelije', 'Pretvorba vodika u struju.'],
  ['Pametne mreže', 'Inteligentno upravljanje distribucijom struje.'],
  ['Geotermalna energija', 'Toplina iz unutrašnjosti Zemlje.'],
  ['Energija plime i valova', 'Iskorištavanje energije mora.'],
  ['Pohrana energije', 'Spremanje viška energije za kasnije.'],
  ['Vodikova energija', 'Vodik kao čisti energent.'],
  ['Solarni paneli', 'Fotonaponski moduli za proizvodnju struje.'],
  ['Transformatori', 'Mijenjaju napon u prijenosu energije.'],
  ['Dalekovodi', 'Prijenos struje na velike udaljenosti.'],
  ['Energetska učinkovitost', 'Smanjenje potrošnje uz isti učinak.'],
  ['Punionice za vozila', 'Infrastruktura za električna vozila.'],
  ['Mikromreže', 'Lokalne energetske mreže s vlastitim izvorima.'],
  ['Biomasa', 'Energija iz organskih materijala.'],
  ['Ugljični otisak', 'Mjera utjecaja na klimu.'],
]

// Kvantno računarstvo [naziv, opis]
const QUANTUM = [
  ['Kubit', 'Kvantna jedinica informacije.'],
  ['Superpozicija', 'Kubit može biti u više stanja istovremeno.'],
  ['Kvantna spregnutost', 'Korelacija kubitova na daljinu.'],
  ['Kvantna vrata', 'Osnovne operacije nad kubitima.'],
  ['Kvantni algoritmi', 'Algoritmi koji iskorištavaju kvantne efekte.'],
  ['Shorov algoritam', 'Brza faktorizacija — prijetnja klasičnoj kriptografiji.'],
  ['Groverov algoritam', 'Ubrzana pretraga nesortiranih podataka.'],
  ['Kvantna korekcija grešaka', 'Zaštita kvantnih stanja od smetnji.'],
  ['Supravodljivi kubiti', 'Pristup koji koriste IBM i Google.'],
  ['Ionski zamke', 'Kubiti od pojedinačnih iona.'],
  ['Kvantna nadmoć', 'Zadatak nedostižan klasičnim računalima.'],
  ['Kvantna kriptografija', 'Sigurna komunikacija temeljena na fizici.'],
  ['Dekoherencija', 'Gubitak kvantnih svojstava zbog okoline.'],
  ['Kvantni hladnjaci', 'Hlađenje gotovo do apsolutne nule.'],
  ['Kvantno strojno učenje', 'Spoj kvantnog računarstva i AI-a.'],
]

// Kibernetička sigurnost [naziv, opis]
const CYBERSEC = [
  ['Šifriranje', 'Zaštita povjerljivosti podataka.'],
  ['Vatrozid (Firewall)', 'Filtriranje mrežnog prometa.'],
  ['Antivirus', 'Otkrivanje i uklanjanje zlonamjernog softvera.'],
  ['Phishing', 'Prijevara radi krađe podataka.'],
  ['Ransomware', 'Zlonamjerni softver koji zaključava podatke.'],
  ['Dvofaktorska autentikacija', 'Dodatni sloj provjere identiteta.'],
  ['Probojno testiranje', 'Simulirani napadi radi pronalaska slabosti.'],
  ['Sigurnosni propusti (CVE)', 'Javno evidentirane ranjivosti.'],
  ['Botnet', 'Mreža kompromitiranih uređaja.'],
  ['DDoS napad', 'Preopterećenje usluge prometom.'],
  ['Upravljanje identitetom', 'Kontrola pristupa korisnika.'],
  ['Zero Trust', 'Nema implicitnog povjerenja u mreži.'],
  ['Sigurnosni operativni centar (SOC)', 'Tim za praćenje prijetnji.'],
  ['Kriptografski ključevi', 'Tajne za šifriranje i potpisivanje.'],
  ['Digitalni potpis', 'Provjera autentičnosti i integriteta.'],
  ['Sigurnost lanca opskrbe', 'Zaštita od kompromitiranih dobavljača.'],
  ['Biometrija', 'Autentikacija otiskom, licem ili glasom.'],
  ['Sigurnost mreže', 'Zaštita komunikacijske infrastrukture.'],
  ['Forenzika', 'Istraga digitalnih incidenata.'],
  ['Postkvantna kriptografija', 'Algoritmi otporni na kvantna računala.'],
]

// Mobilni uređaji [naziv, opis]
const MOBILE = [
  ['Pametni telefon', 'Računalo u džepu s ekranom na dodir.'],
  ['Tablet', 'Veći mobilni uređaj za sadržaj i rad.'],
  ['Pametni sat', 'Nosivi uređaj za obavijesti i zdravlje.'],
  ['Ekran na dodir', 'Kapacitivni zaslon kao glavno sučelje.'],
  ['Mobilni procesor (SoC)', 'Sustav na čipu za mobilne uređaje.'],
  ['Baterija i punjenje', 'Napajanje i brzo punjenje uređaja.'],
  ['Kamere u mobitelima', 'Napredni senzori i računalna fotografija.'],
  ['GPS u uređajima', 'Lokacijske usluge i navigacija.'],
  ['NFC', 'Bežično plaćanje i kratkodometna komunikacija.'],
  ['Biometrija na uređaju', 'Otključavanje licem ili otiskom.'],
  ['Mobilne aplikacije', 'Programi za pametne uređaje.'],
  ['Trgovine aplikacija', 'Distribucija aplikacija korisnicima.'],
  ['Bežično punjenje', 'Punjenje bez kabela.'],
  ['Savitljivi zasloni', 'Sklopivi i rastezljivi ekrani.'],
  ['Mobilna fotografija', 'Snimanje i obrada fotografija na uređaju.'],
  ['Senzori u mobitelu', 'Žiroskop, akcelerometar, barometar i dr.'],
  ['Mobilno plaćanje', 'Digitalne novčanice i transakcije.'],
  ['Slušalice (bežične)', 'Bežični audio uređaji.'],
  ['eSIM', 'Ugrađena SIM kartica.'],
  ['Mobilna sigurnost', 'Zaštita podataka na uređaju.'],
]

// Audio i video [naziv, opis]
const AUDIOVIDEO = [
  ['Gramofon', 'Reprodukcija zvuka s ploče.'],
  ['Magnetska traka', 'Snimanje zvuka i slike na traku.'],
  ['Kompakt disk (CD)', 'Digitalna optička pohrana zvuka.'],
  ['MP3', 'Komprimirani digitalni audio format.'],
  ['Digitalna fotografija', 'Snimanje slike senzorom umjesto filma.'],
  ['Visoka razlučivost (HD)', 'Oštrija slika i veći broj piksela.'],
  ['4K i 8K', 'Vrlo visoka razlučivost slike.'],
  ['HDR', 'Veći raspon svjetline i boja.'],
  ['Kodeci (H.264, AV1)', 'Kompresija videa za pohranu i prijenos.'],
  ['Strujanje videa', 'Isporuka videa u stvarnom vremenu.'],
  ['Prostorni zvuk', 'Trodimenzionalni doživljaj zvuka.'],
  ['Mikrofoni', 'Pretvaraju zvuk u električni signal.'],
  ['Zvučnici', 'Pretvaraju signal natrag u zvuk.'],
  ['OLED zasloni', 'Sami svijetleći pikseli, duboke crne.'],
  ['LCD zasloni', 'Tekuće kristalne zaslone tehnologije.'],
  ['Projektori', 'Prikaz slike na velikoj površini.'],
  ['Računalna grafika', 'Generiranje slika računalom.'],
  ['Montaža videa', 'Obrada i uređivanje snimaka.'],
  ['Sinteza zvuka', 'Elektroničko stvaranje zvukova.'],
  ['Digitalne kamere', 'Uređaji za snimanje fotografija i videa.'],
]

// Transport i vozila [naziv, opis]
const TRANSPORT = [
  ['Električna vozila', 'Vozila pogonjena baterijama.'],
  ['Autonomna vožnja', 'Vozila koja sama upravljaju.'],
  ['Hibridna vozila', 'Kombinacija motora s unutarnjim izgaranjem i elektromotora.'],
  ['Brzi vlakovi', 'Vlakovi velikih brzina.'],
  ['Maglev', 'Vlakovi na magnetskoj levitaciji.'],
  ['Mlazni motori', 'Pogon modernih zrakoplova.'],
  ['Raketni motori', 'Pogon za svemirske letove.'],
  ['Sustavi za pomoć vozaču (ADAS)', 'Senzori i AI za sigurniju vožnju.'],
  ['Lidar', 'Lasersko mjerenje udaljenosti za vozila.'],
  ['Pametna prometna signalizacija', 'Optimizacija prometnih tokova.'],
  ['Dijeljena mobilnost', 'Dijeljenje vozila i prijevoza.'],
  ['Punjenje vozila', 'Infrastruktura za električnu mobilnost.'],
  ['Dronovi za dostavu', 'Bespilotna dostava paketa.'],
  ['Hyperloop', 'Koncept prijevoza u vakuumskim cijevima.'],
  ['Električni bicikli i romobili', 'Mikromobilnost u gradovima.'],
  ['Brodski pogoni', 'Tehnologije pomorskog prijevoza.'],
  ['Telemetrija vozila', 'Praćenje stanja i položaja vozila.'],
  ['Sigurnosni sustavi', 'Zračni jastuci, ABS i kontrola stabilnosti.'],
  ['Navigacijski sustavi', 'Vođenje vozača do odredišta.'],
  ['Logistika i flote', 'Upravljanje voznim parkom.'],
]

// Biotehnologija i medicinska tehnologija [naziv, opis]
const BIOTECH = [
  ['Sekvenciranje DNK', 'Čitanje genetskog koda.'],
  ['CRISPR', 'Precizno uređivanje gena.'],
  ['mRNA cjepiva', 'Cjepiva temeljena na glasničkoj RNK.'],
  ['Magnetska rezonancija (MRI)', 'Snimanje unutrašnjosti tijela.'],
  ['CT skener', 'Računalna tomografija tijela.'],
  ['Ultrazvuk', 'Snimanje zvučnim valovima.'],
  ['Medicinski implantati', 'Uređaji ugrađeni u tijelo.'],
  ['Proteze i bionika', 'Umjetni udovi i organi.'],
  ['Telemedicina', 'Zdravstvena skrb na daljinu.'],
  ['Nosivi zdravstveni uređaji', 'Praćenje vitalnih znakova.'],
  ['Bioinformatika', 'Računalna analiza bioloških podataka.'],
  ['Tkivno inženjerstvo', 'Uzgoj umjetnog tkiva.'],
  ['Laboratorij na čipu', 'Minijaturizirane analize.'],
  ['Robotska kirurgija', 'Precizni kirurški roboti.'],
  ['Otkrivanje lijekova', 'Računalno potpomognut razvoj lijekova.'],
  ['Genetski testovi', 'Analiza nasljednih svojstava.'],
  ['Biosenzori', 'Detekcija bioloških signala.'],
  ['Neuroprotetika', 'Sučelja mozga i stroja.'],
  ['Sintetska biologija', 'Dizajn novih bioloških sustava.'],
  ['Dijagnostika temeljena na AI-u', 'Računalna analiza medicinskih slika.'],
]

// Materijali i nanotehnologija [naziv, opis]
const MATERIALS = [
  ['Poluvodiči', 'Materijali u srcu moderne elektronike.'],
  ['Silicij', 'Temeljni materijal čipova.'],
  ['Grafen', 'Jednoslojni ugljik iznimnih svojstava.'],
  ['Ugljikove nanocijevi', 'Vrlo čvrste nanostrukture.'],
  ['Supravodiči', 'Materijali bez električnog otpora.'],
  ['Kompozitni materijali', 'Spoj materijala za bolja svojstva.'],
  ['Pametni materijali', 'Reagiraju na okolinu.'],
  ['Nanomaterijali', 'Strukture na nanometarskoj skali.'],
  ['Polimeri', 'Plastike i sintetski materijali.'],
  ['Keramika', 'Tvrdi i toplinski otporni materijali.'],
  ['Metalurgija', 'Znanost o metalima i legurama.'],
  ['Tankoslojne tehnologije', 'Nanošenje vrlo tankih slojeva.'],
  ['Fotonika', 'Tehnologije temeljene na svjetlosti.'],
  ['Biorazgradivi materijali', 'Materijali koji se razgrađuju.'],
  ['Litografija', 'Izrada sitnih struktura na čipovima.'],
  ['Aerogel', 'Iznimno lagan porozni materijal.'],
  ['Magnetski materijali', 'Temelj memorija i motora.'],
  ['Premazi i prevlake', 'Zaštita i funkcionalne površine.'],
  ['Materijali za baterije', 'Razvoj boljih elektroda i elektrolita.'],
  ['Metamaterijali', 'Umjetne strukture s neobičnim svojstvima.'],
]

// Pohrana podataka [naziv, opis]
const STORAGE = [
  ['Bušene kartice', 'Rana mehanička pohrana podataka.'],
  ['Magnetska traka', 'Sekvencijalna pohrana velikog kapaciteta.'],
  ['Tvrdi disk (HDD)', 'Magnetska pohrana s rotirajućim pločama.'],
  ['Disketa', 'Prijenosna magnetska pohrana.'],
  ['Optički diskovi (CD/DVD/Blu-ray)', 'Pohrana laserskim čitanjem.'],
  ['Flash memorija', 'Brza poluvodička pohrana.'],
  ['SSD', 'Disk bez pokretnih dijelova.'],
  ['USB stick', 'Prijenosna flash pohrana.'],
  ['Memorijske kartice', 'Pohrana za kamere i mobitele.'],
  ['RAID', 'Povezivanje diskova radi pouzdanosti i brzine.'],
  ['Mrežna pohrana (NAS)', 'Dijeljena pohrana na mreži.'],
  ['Pohrana u oblaku', 'Podaci na udaljenim poslužiteljima.'],
  ['Hladna pohrana', 'Dugoročno arhiviranje podataka.'],
  ['DNK pohrana', 'Eksperimentalna pohrana u molekulama.'],
  ['Datotečni sustavi', 'Organizacija podataka na mediju.'],
  ['Kompresija podataka', 'Smanjenje veličine podataka.'],
  ['Sigurnosne kopije', 'Zaštita od gubitka podataka.'],
  ['Deduplikacija', 'Uklanjanje duplikata radi uštede prostora.'],
  ['Memorijska hijerarhija', 'Slojevi pohrane po brzini i cijeni.'],
  ['Objektna pohrana', 'Pohrana podataka kao objekata.'],
]

// Igre i zabavna tehnologija [naziv, opis]
const GAMING = [
  ['Arkadne igre', 'Rane igraće mašine u salonima.'],
  ['Kućne konzole', 'Uređaji za igranje na televizoru.'],
  ['Atari 2600', 'Popularizirao kućne videoigre.'],
  ['Nintendo Entertainment System', 'Oživio industriju videoigara 1980-ih.'],
  ['PlayStation', 'Sonyjeva uspješna serija konzola.'],
  ['Xbox', 'Microsoftova konzola s online uslugama.'],
  ['Nintendo Switch', 'Hibridna prijenosno-kućna konzola.'],
  ['Računalne igre (PC)', 'Igranje na osobnim računalima.'],
  ['Grafički procesori za igre', 'GPU-i koji pokreću modernu grafiku.'],
  ['Game engine', 'Okviri za izradu igara (Unity, Unreal).'],
  ['Mrežno igranje', 'Igranje s drugima preko interneta.'],
  ['Esport', 'Natjecateljsko igranje videoigara.'],
  ['Mobilne igre', 'Igre na pametnim telefonima.'],
  ['Igre u oblaku', 'Strujanje igara s poslužitelja.'],
  ['Fizika u igrama', 'Simulacija stvarnog ponašanja objekata.'],
  ['Procesori za grafiku u stvarnom vremenu', 'Renderiranje scena uživo.'],
  ['Ray tracing', 'Realistično osvjetljenje praćenjem zraka.'],
  ['Upravljači i periferija', 'Kontroleri, volani i drugi uređaji.'],
  ['Virtualna ekonomija', 'Digitalna dobra unutar igara.'],
  ['Haptika', 'Povratna sprega dodirom u igrama.'],
]

// Proširena i virtualna stvarnost [naziv, opis]
const ARVR = [
  ['Virtualna stvarnost (VR)', 'Potpuno digitalno okruženje.'],
  ['Proširena stvarnost (AR)', 'Digitalni sadržaj preko stvarnog svijeta.'],
  ['Mješovita stvarnost (MR)', 'Spoj stvarnog i virtualnog.'],
  ['VR naočale', 'Uređaji za uranjanje u virtualni svijet.'],
  ['Praćenje pokreta', 'Snimanje kretanja korisnika.'],
  ['Prostorno računarstvo', 'Računarstvo svjesno prostora oko nas.'],
  ['Haptičke rukavice', 'Osjet dodira u virtualnom okruženju.'],
  ['3D skeniranje', 'Digitalizacija stvarnih objekata.'],
  ['Avatari', 'Digitalni prikazi korisnika.'],
  ['Metaverzum', 'Povezani virtualni svjetovi.'],
  ['Praćenje pogleda', 'Mjerenje smjera pogleda korisnika.'],
  ['Renderiranje za VR', 'Prikaz scena u stvarnom vremenu.'],
  ['Simulatori obuke', 'Učenje u sigurnom virtualnom okruženju.'],
  ['Projekcijsko mapiranje', 'Projiciranje slike na objekte.'],
  ['Digitalni blizanci', 'Virtualne kopije stvarnih sustava.'],
]

// Internet stvari (IoT) [naziv, opis]
const IOT = [
  ['Pametni dom', 'Povezani uređaji u kući.'],
  ['Pametni termostati', 'Automatsko upravljanje grijanjem.'],
  ['Pametna rasvjeta', 'Daljinski upravljiva rasvjeta.'],
  ['Senzorske mreže', 'Distribuirani senzori koji mjere okolinu.'],
  ['Pametni gradovi', 'Tehnologija za upravljanje gradom.'],
  ['Industrijski IoT', 'Povezani strojevi u proizvodnji.'],
  ['Nosivi uređaji', 'Tehnologija koja se nosi na tijelu.'],
  ['Rubno računarstvo (Edge)', 'Obrada podataka blizu izvora.'],
  ['MQTT', 'Lagani protokol za IoT komunikaciju.'],
  ['Pametna brojila', 'Mjerenje potrošnje energije.'],
  ['Praćenje sredstava', 'Lokacija i stanje opreme.'],
  ['Pametna poljoprivreda', 'Senzori za usjeve i tlo.'],
  ['Daljinsko upravljanje', 'Kontrola uređaja na daljinu.'],
  ['Niskoenergetske mreže (LoRa)', 'Komunikacija na velike udaljenosti uz malu potrošnju.'],
  ['Sigurnost IoT uređaja', 'Zaštita povezanih uređaja.'],
  ['Pametna zdravstvena skrb', 'Praćenje zdravlja povezanim uređajima.'],
  ['Automatizacija zgrada', 'Upravljanje sustavima u zgradama.'],
  ['Telemetrija', 'Prikupljanje i slanje izmjerenih podataka.'],
  ['Aktuatori u IoT-u', 'Uređaji koji djeluju na okolinu.'],
  ['Platforme za IoT', 'Sustavi za upravljanje uređajima.'],
]

// Blockchain i kriptovalute [naziv, opis]
const BLOCKCHAIN = [
  ['Blockchain', 'Distribuirana i nepromjenjiva knjiga zapisa.'],
  ['Bitcoin', 'Prva decentralizirana kriptovaluta.'],
  ['Ethereum', 'Platforma za pametne ugovore.'],
  ['Pametni ugovori', 'Programi koji se izvršavaju na lancu.'],
  ['Rudarenje', 'Potvrđivanje transakcija računalnim radom.'],
  ['Dokaz rada (PoW)', 'Mehanizam konsenzusa temeljen na računanju.'],
  ['Dokaz uloga (PoS)', 'Konsenzus temeljen na ulogu sredstava.'],
  ['Kripto novčanici', 'Pohrana digitalnih ključeva.'],
  ['NFT', 'Nezamjenjivi digitalni tokeni.'],
  ['Decentralizirane financije (DeFi)', 'Financijske usluge bez posrednika.'],
  ['Konsenzusni algoritmi', 'Postizanje slaganja u mreži.'],
  ['Distribuirana knjiga (DLT)', 'Tehnologija dijeljenih zapisa.'],
  ['Stabilni tokeni (stablecoin)', 'Kriptovalute vezane uz stabilnu vrijednost.'],
  ['Kriptografski hash', 'Sažetak podataka fiksne duljine.'],
  ['Lanci drugog sloja (L2)', 'Skaliranje izvan glavnog lanca.'],
  ['Decentralizirane aplikacije', 'Aplikacije koje rade na lancu.'],
  ['Tokenizacija', 'Pretvorba imovine u digitalne tokene.'],
  ['Upravljanje (DAO)', 'Decentralizirane autonomne organizacije.'],
  ['Privatnost na lancu', 'Tehnologije zaštite identiteta.'],
  ['Interoperabilnost lanaca', 'Povezivanje različitih blockchaina.'],
]

// Senzori i mjerenja [naziv, opis]
const SENSORS = [
  ['Akcelerometar', 'Mjeri ubrzanje i nagib.'],
  ['Žiroskop', 'Mjeri kutnu brzinu i orijentaciju.'],
  ['Senzor temperature', 'Mjeri toplinu okoline.'],
  ['Senzor svjetla', 'Detektira jakost svjetlosti.'],
  ['Senzor blizine', 'Detektira prisutnost objekata.'],
  ['Senzor tlaka', 'Mjeri tlak plina ili tekućine.'],
  ['Senzor vlage', 'Mjeri vlažnost zraka ili tla.'],
  ['Lidar', 'Lasersko mjerenje udaljenosti.'],
  ['Radar', 'Detekcija objekata radiovalovima.'],
  ['Senzor plina', 'Detektira prisutnost plinova.'],
  ['Biometrijski senzori', 'Mjere fizičke značajke osoba.'],
  ['Kamere kao senzori', 'Vizualno prikupljanje podataka.'],
  ['Senzor zvuka', 'Detekcija i mjerenje zvuka.'],
  ['Magnetski senzor', 'Mjeri magnetsko polje.'],
  ['GPS prijemnik', 'Određivanje položaja satelitima.'],
]

// Izumitelji i pioniri tehnologije [ime, godine, doprinos]
const INVENTORS = [
  ['Nikola Tesla', '1856–1943', 'Sustav izmjenične struje, indukcijski motor, bežični prijenos (rođen u Hrvatskoj).'],
  ['Thomas Edison', '1847–1931', 'Žarulja, fonograf, sustavi distribucije struje.'],
  ['Alexander Graham Bell', '1847–1922', 'Izum telefona.'],
  ['Guglielmo Marconi', '1874–1937', 'Razvoj bežične radio komunikacije.'],
  ['Michael Faraday', '1791–1867', 'Elektromagnetska indukcija, temelj elektromotora.'],
  ['James Clerk Maxwell', '1831–1879', 'Jednadžbe elektromagnetizma.'],
  ['Alessandro Volta', '1745–1827', 'Izum prve baterije (voltin stup).'],
  ['Heinrich Hertz', '1857–1894', 'Dokazao postojanje radiovalova.'],
  ['John Bardeen', '1908–1991', 'Suizumitelj tranzistora, dvostruki nobelovac.'],
  ['William Shockley', '1910–1989', 'Suizumitelj tranzistora.'],
  ['Jack Kilby', '1923–2005', 'Izum integriranog sklopa.'],
  ['Robert Noyce', '1927–1990', 'Suizumitelj integriranog sklopa, suosnivač Intela.'],
  ['Gordon Moore', '1929–2023', 'Mooreov zakon, suosnivač Intela.'],
  ['Federico Faggin', '1941–', 'Dizajn prvog mikroprocesora Intel 4004.'],
  ['Philo Farnsworth', '1906–1971', 'Pionir elektroničke televizije.'],
  ['Wilhelm Röntgen', '1845–1923', 'Otkriće X-zraka, prvi Nobel za fiziku.'],
  ['Marie Curie', '1867–1934', 'Istraživanje radioaktivnosti, dvostruka nobelovka.'],
  ['Theodore Maiman', '1927–2007', 'Konstruirao prvi laser.'],
  ['Hedy Lamarr', '1914–2000', 'Frekvencijsko skakanje, temelj bežičnih tehnologija.'],
  ['Tim Berners-Lee', '1955–', 'Izumitelj World Wide Weba.'],
  ['Vint Cerf', '1943–', 'Suautor TCP/IP protokola.'],
  ['Charles Babbage', '1791–1871', 'Koncept analitičkog stroja.'],
  ['Ada Lovelace', '1815–1852', 'Prvi algoritam za stroj.'],
  ['Claude Shannon', '1916–2001', 'Teorija informacije.'],
  ['Frank Whittle', '1907–1996', 'Razvoj mlaznog motora.'],
  ['Wright braća', '1871–1948', 'Prvi motorni let.'],
  ['Karl Benz', '1844–1929', 'Prvi praktični automobil.'],
  ['Rudolf Diesel', '1858–1913', 'Izum dizelskog motora.'],
  ['James Watt', '1736–1819', 'Usavršio parni stroj.'],
  ['Johannes Gutenberg', '1400–1468', 'Tisak pomičnim slovima.'],
  ['Samuel Morse', '1791–1872', 'Telegraf i Morseova abeceda.'],
  ['Faust Vrančić', '1551–1617', 'Hrvatski izumitelj, padobran (Homo Volans).'],
  ['Slavoljub Penkala', '1871–1922', 'Hrvatski izumitelj mehaničke olovke i nalivpera.'],
  ['Ruđer Bošković', '1711–1787', 'Hrvatski znanstvenik, teorija sila i atomistika.'],
  ['Grace Hopper', '1906–1992', 'Pionirka programiranja, prvi prevoditelj.'],
  ['Werner von Braun', '1912–1977', 'Razvoj raketa i programa Apollo.'],
  ['Konstantin Ciolkovski', '1857–1935', 'Teorijski temelji astronautike.'],
  ['George Westinghouse', '1846–1914', 'Promicao izmjeničnu struju i zračne kočnice.'],
  ['Lee de Forest', '1873–1961', 'Izum trioda — pojačala signala.'],
  ['Jack Dorsey', '1976–', 'Suosnivač platformi za mikroblogiranje i plaćanja.'],
]

// Tehnološke tvrtke [naziv, godina, opis]
const COMPANIES = [
  ['Intel', '1968', 'Pionir mikroprocesora i x86 arhitekture.'],
  ['AMD', '1969', 'Proizvođač procesora i grafičkih čipova.'],
  ['NVIDIA', '1993', 'Lider u GPU-ima i AI ubrzanju.'],
  ['IBM', '1911', 'Mainframe računala, istraživanje, kvantno računarstvo.'],
  ['Apple', '1976', 'Osobna računala, iPhone, vlastiti čipovi.'],
  ['Samsung', '1938', 'Elektronika, čipovi, zasloni i uređaji.'],
  ['Sony', '1946', 'Zabavna elektronika, konzole, senzori slike.'],
  ['Microsoft', '1975', 'Softver, oblak i konzole.'],
  ['Google', '1998', 'Pretraživanje, Android, AI, TPU.'],
  ['Tesla', '2003', 'Električna vozila i pohrana energije.'],
  ['SpaceX', '2002', 'Ponovno upotrebljive rakete i Starlink.'],
  ['Qualcomm', '1985', 'Mobilni čipovi i komunikacijske tehnologije.'],
  ['ARM', '1990', 'Energetski učinkovite procesorske arhitekture.'],
  ['TSMC', '1987', 'Najveći proizvođač čipova po narudžbi.'],
  ['Texas Instruments', '1930', 'Poluvodiči i ugrađeni procesori.'],
  ['Motorola', '1928', 'Mobiteli, mikroprocesori i komunikacije.'],
  ['Nokia', '1865', 'Telekomunikacije i mreže.'],
  ['Ericsson', '1876', 'Mrežna oprema i telekomunikacije.'],
  ['Siemens', '1847', 'Industrijska tehnologija i automatizacija.'],
  ['Philips', '1891', 'Elektronika, rasvjeta i medicinska tehnologija.'],
  ['Toshiba', '1875', 'Elektronika, memorije i energetika.'],
  ['Huawei', '1987', 'Mrežna oprema i pametni telefoni.'],
  ['Cisco', '1984', 'Mrežna oprema i internetska infrastruktura.'],
  ['Boeing', '1916', 'Zrakoplovstvo i svemirska tehnologija.'],
  ['Airbus', '1970', 'Zrakoplovi i svemirski sustavi.'],
  ['General Electric', '1892', 'Industrija, energetika i zrakoplovni motori.'],
  ['Bell Labs', '1925', 'Tranzistor, laser, teorija informacije.'],
  ['Bosch', '1886', 'Automobilska i industrijska tehnologija.'],
  ['ASML', '1984', 'Strojevi za litografiju čipova.'],
  ['LG', '1958', 'Elektronika i zasloni.'],
  ['Panasonic', '1918', 'Elektronika i baterije.'],
  ['Hitachi', '1910', 'Industrijska i informacijska tehnologija.'],
  ['Foxconn', '1974', 'Najveći ugovorni proizvođač elektronike.'],
  ['Dell', '1984', 'Osobna i poslovna računala.'],
  ['HP', '1939', 'Računala, pisači i instrumenti.'],
]

// ───────────────────────────────────────────────────────────────────────────
//  BUILDERI ZA PODSTABLA
// ───────────────────────────────────────────────────────────────────────────
const eventNode = ([y, t, d]) =>
  N(`${y} — ${t}`, { cat: 'fact', summary: d, kind: 'event', children: [
    N(`Razdoblje: ${y}`, { cat: 'fact' }),
    N(`Detalji: ${d}`, { cat: 'note', summary: d }),
  ] })

const pairNode = (prefix, cat, kind) => ([a, b]) =>
  N(`${prefix}${a}`, { cat, summary: b, kind, children: [ N(`Opis: ${b}`, { cat: 'note', summary: b }) ] })

const yearMakerNode = (prefix, cat, kind) => ([name, year, maker, desc]) =>
  N(`${prefix}${name}`, { cat, summary: `${name} (${year}, ${maker}) — ${desc}`, kind, children: [
    N(`Godina: ${year}`, { cat: 'fact' }),
    N(`Proizvođač/akter: ${maker}`, { cat: 'example' }),
    N(`Opis: ${desc}`, { cat: 'note', summary: desc }),
  ] })

const inventorNode = ([name, years, contrib]) =>
  N(`Izumitelj: ${name}`, { cat: 'example', summary: `${name} (${years}) — ${contrib}`, kind: 'person', children: [
    N(`Razdoblje: ${years}`, { cat: 'fact' }),
    N(`Doprinos: ${contrib}`, { cat: 'note', summary: contrib }),
  ] })

const companyNode = ([name, year, desc]) =>
  N(`Tvrtka: ${name}`, { cat: 'note', summary: `${name} (osn. ${year}) — ${desc}`, kind: 'org', children: [
    N(`Osnovana: ${year}`, { cat: 'fact' }),
    N(`Doprinos: ${desc}`, { cat: 'note', summary: desc }),
  ] })

// ── Glavne grane ───────────────────────────────────────────────────────────
const BRANCHES = [
  N('Vremenska crta tehnologije', { cat: 'fact', summary: 'Ključne prekretnice u razvoju tehnologije.', children: TIMELINE.map(eventNode) }),
  N('Računalni hardver', { cat: 'process', summary: 'Fizičke komponente računalnih sustava.', children: HARDWARE.map(pairNode('Komponenta: ', 'process', 'tech')) }),
  N('Mikroprocesori i čipovi', { cat: 'concept', summary: 'Evolucija procesora i integriranih sklopova.', children: CHIPS.map(yearMakerNode('Čip: ', 'concept', 'tech')) }),
  N('Internet i mreže', { cat: 'fact', summary: 'Tehnologije koje povezuju svijet.', children: INTERNET.map(pairNode('Mreže: ', 'fact', 'tech')) }),
  N('Umjetna inteligencija', { cat: 'concept', summary: 'Strojno učenje i inteligentni sustavi.', children: AI.map(pairNode('AI: ', 'concept', 'concept')) }),
  N('Robotika i automatizacija', { cat: 'process', summary: 'Strojevi koji opažaju i djeluju.', children: ROBOTICS.map(pairNode('Robotika: ', 'process', 'concept')) }),
  N('Svemirska tehnologija', { cat: 'example', summary: 'Istraživanje i osvajanje svemira.', children: SPACE.map(yearMakerNode('Svemir: ', 'example', 'tech')) }),
  N('Telekomunikacije', { cat: 'fact', summary: 'Prijenos informacija na daljinu.', children: TELECOM.map(pairNode('Telekom: ', 'fact', 'tech')) }),
  N('Elektronika i komponente', { cat: 'definition', summary: 'Gradivni blokovi elektroničkih sklopova.', children: ELECTRONICS.map(pairNode('Elektronika: ', 'definition', 'tech')) }),
  N('Energetika i obnovljivi izvori', { cat: 'process', summary: 'Proizvodnja, prijenos i pohrana energije.', children: ENERGY.map(pairNode('Energija: ', 'process', 'concept')) }),
  N('Kvantno računarstvo', { cat: 'question', summary: 'Računarstvo temeljeno na kvantnoj fizici.', children: QUANTUM.map(pairNode('Kvantno: ', 'question', 'concept')) }),
  N('Kibernetička sigurnost', { cat: 'question', summary: 'Zaštita digitalnih sustava i podataka.', children: CYBERSEC.map(pairNode('Sigurnost: ', 'question', 'concept')) }),
  N('Mobilni uređaji', { cat: 'concept', summary: 'Pametni telefoni i nosiva tehnologija.', children: MOBILE.map(pairNode('Mobilno: ', 'concept', 'tech')) }),
  N('Audio i video tehnologije', { cat: 'example', summary: 'Snimanje, prijenos i reprodukcija medija.', children: AUDIOVIDEO.map(pairNode('Medij: ', 'example', 'tech')) }),
  N('Transport i vozila', { cat: 'process', summary: 'Tehnologije kretanja i mobilnosti.', children: TRANSPORT.map(pairNode('Transport: ', 'process', 'tech')) }),
  N('Biotehnologija i medicina', { cat: 'definition', summary: 'Tehnologija u službi zdravlja i života.', children: BIOTECH.map(pairNode('Biotech: ', 'definition', 'concept')) }),
  N('Materijali i nanotehnologija', { cat: 'definition', summary: 'Materijali koji omogućuju nove tehnologije.', children: MATERIALS.map(pairNode('Materijal: ', 'definition', 'concept')) }),
  N('Pohrana podataka', { cat: 'process', summary: 'Tehnologije za čuvanje digitalnih podataka.', children: STORAGE.map(pairNode('Pohrana: ', 'process', 'tech')) }),
  N('Igre i zabavna tehnologija', { cat: 'example', summary: 'Tehnologija videoigara i zabave.', children: GAMING.map(pairNode('Igre: ', 'example', 'tech')) }),
  N('Proširena i virtualna stvarnost', { cat: 'concept', summary: 'Uranjajuća i prostorna računalna iskustva.', children: ARVR.map(pairNode('XR: ', 'concept', 'tech')) }),
  N('Internet stvari (IoT)', { cat: 'fact', summary: 'Povezani uređaji u svakodnevici i industriji.', children: IOT.map(pairNode('IoT: ', 'fact', 'tech')) }),
  N('Blockchain i kriptovalute', { cat: 'note', summary: 'Decentralizirane knjige i digitalne valute.', children: BLOCKCHAIN.map(pairNode('Blockchain: ', 'note', 'concept')) }),
  N('Senzori i mjerenja', { cat: 'definition', summary: 'Uređaji koji opažaju fizički svijet.', children: SENSORS.map(pairNode('Senzor: ', 'definition', 'tech')) }),
  N('Izumitelji i pioniri', { cat: 'example', summary: 'Ljudi koji su oblikovali tehnologiju.', children: INVENTORS.map(inventorNode) }),
  N('Tehnološke tvrtke', { cat: 'note', summary: 'Tvrtke koje pokreću tehnološki napredak.', children: COMPANIES.map(companyNode) }),
]

const ROOT = N('Tehnologija — povijest i sadašnjost', {
  cat: 'root',
  summary: 'Interaktivna mapa znanja o razvoju i današnjem stanju tehnologije i inženjerstva, na hrvatskom jeziku.',
  children: BRANCHES,
})

// ───────────────────────────────────────────────────────────────────────────
//  STRUKTURIRANO PROŠIRENJE DO TOČNO TARGET ČVOROVA
// ───────────────────────────────────────────────────────────────────────────
function countNodes(node) {
  let c = 1
  if (node.children) for (const ch of node.children) c += countNodes(ch)
  return c
}

const ASPECTS = {
  tech: [
    ['Povijesni kontekst', 'nastao je kao odgovor na potrebe svoga vremena i razvijao se kroz niz inačica.'],
    ['Princip rada', 'počiva na jasnom fizikalnom ili inženjerskom načelu.'],
    ['Ključne značajke', 'donosi prepoznatljiv skup mogućnosti koje su definirale njegovu upotrebu.'],
    ['Tipične primjene', 'koristi se u stvarnim sustavima gdje njegove prednosti dolaze do izražaja.'],
    ['Komponente', 'sastoji se od prepoznatljivih dijelova koji surađuju.'],
    ['Performanse', 'pokazuje karakteristične profile brzine, kapaciteta i potrošnje.'],
    ['Proizvodnja', 'izrađuje se ustaljenim tehnološkim postupcima.'],
    ['Prednosti', 'nudi konkretne prednosti koje su pridonijele njegovu usvajanju.'],
    ['Ograničenja', 'ima kompromise i scenarije u kojima druga rješenja bolje odgovaraju.'],
    ['Utjecaj', 'ostavio je trag na kasnije tehnologije i svakodnevni život.'],
    ['Suvremeni status', 'i danas ima jasnu ulogu u modernoj tehnologiji.'],
    ['Ekosustav', 'okružen je standardima, alatima i industrijom koja ga podržava.'],
    ['Sigurnosni aspekti', 'donosi specifične sigurnosne odlike i rizike koje treba poznavati.'],
    ['Okolišni utjecaj', 'ima učinke na okoliš o kojima struka vodi računa.'],
    ['Standardizacija', 'razvoj prati formalna ili de facto standardizacija.'],
    ['Tržište i usvajanje', 'prošao je put od inovacije do šire upotrebe.'],
    ['Alternative', 'postoje srodne tehnologije koje rješavaju slične probleme drugačije.'],
    ['Održavanje', 'zahtijeva određenu njegu i servisiranje tijekom vijeka.'],
    ['Troškovi', 'ima karakterističnu strukturu troškova izrade i upotrebe.'],
    ['Budući smjer', 'razvoj se nastavlja u skladu s potrebama industrije.'],
    ['Zanimljivost', 'uz njega se vežu zanimljive činjenice iz povijesti tehnologije.'],
    ['Primjer iz prakse', 'najbolje se razumije kroz konkretan primjer primjene.'],
    ['Povezane tehnologije', 'usko je povezan s drugim tehnologijama i sustavima.'],
    ['Sažetak', 'ključna poruka koju vrijedi zapamtiti o ovoj temi.'],
    ['Mjere i jedinice', 'opisuje se prepoznatljivim mjerama i jedinicama.'],
    ['Norme kvalitete', 'podliježe normama koje jamče pouzdanost i kvalitetu.'],
  ],
  concept: [
    ['Definicija', 'precizno opisuje ideju i njezino mjesto u tehnologiji.'],
    ['Motivacija', 'odgovara na konkretan problem ili potrebu.'],
    ['Kako funkcionira', 'počiva na jasnom mehanizmu ili načelu rada.'],
    ['Primjer u praksi', 'najbolje se razumije kroz konkretan primjer primjene.'],
    ['Prednosti', 'donosi mjerljive koristi kada se primjenjuje ispravno.'],
    ['Nedostaci', 'ima ograničenja koja treba uzeti u obzir.'],
    ['Zamke i greške', 'česte su pogreške koje treba izbjegavati pri primjeni.'],
    ['Povezani pojmovi', 'usko je povezan s drugim idejama i tehnikama.'],
    ['Povijest ideje', 'razvijao se kroz rad istraživača i inženjera tijekom godina.'],
    ['Suvremena upotreba', 'aktualan je i danas u modernim sustavima.'],
    ['Kada koristiti', 'postoje situacije u kojima je posebno prikladan.'],
    ['Kada izbjegavati', 'nije univerzalno rješenje i ima neprikladne kontekste.'],
    ['Složenost', 'nosi određenu cijenu u resursima ili razumijevanju.'],
    ['Mjerenje i metrike', 'uspjeh primjene može se pratiti odgovarajućim metrikama.'],
    ['Utjecaj na društvo', 'mijenja način na koji ljudi žive i rade.'],
    ['Alternativni pristupi', 'postoje druge tehnike koje rješavaju sličan problem.'],
    ['Primjena u industriji', 'nalazi primjenu u različitim granama industrije.'],
    ['Veza s drugim područjima', 'povezuje više znanstvenih i inženjerskih disciplina.'],
    ['Automatizacija', 'dijelovi se mogu automatizirati odgovarajućim alatima.'],
    ['Najbolje prakse', 'postoje preporučeni obrasci za uspješnu primjenu.'],
    ['Edukacija', 'važan je dio obrazovanja inženjera i znanstvenika.'],
    ['Standardi i smjernice', 'vežu ga formalne ili neformalne smjernice struke.'],
    ['Etika i regulativa', 'otvara pitanja etike i zakonske regulacije.'],
    ['Budućnost', 'i dalje se razvija s napretkom znanosti i tehnologije.'],
    ['Zanimljivost', 'uz njega se vežu zanimljive činjenice.'],
    ['Sažetak', 'ključna poruka koju vrijedi zapamtiti.'],
  ],
  person: [
    ['Biografija', 'životni put oblikovao je doprinose tehnologiji.'],
    ['Obrazovanje', 'formalni put doveo je do područja rada.'],
    ['Ključni doprinos', 'rad je trajno utjecao na razvoj tehnologije.'],
    ['Glavna djela', 'iza imena stoje prepoznatljivi izumi i ideje.'],
    ['Nagrade i priznanja', 'doprinosi su prepoznati u znanstvenoj zajednici.'],
    ['Naslijeđe', 'ideje žive u uređajima i sustavima koje danas koristimo.'],
    ['Povezane osobe', 'surađivao/la je i utjecao/la na druge pionire.'],
    ['Kontekst vremena', 'djelovao/la je u određenom povijesnom razdoblju.'],
    ['Područja rada', 'bavio/la se prepoznatljivim područjima.'],
    ['Utjecaj na industriju', 'rad je promijenio praksu u industriji.'],
    ['Anegdote', 'uz ime se vežu poznate priče.'],
    ['Suradnje', 'surađivao/la je s institucijama i tvrtkama.'],
    ['Citati i misli', 'ostavio/la je zapažene misli o tehnologiji.'],
    ['Daljnje čitanje', 'o životu i radu postoji opsežna literatura.'],
    ['Zanimljivost', 'uz njega/nju vežu se zanimljive činjenice.'],
    ['Sažetak doprinosa', 'ključna ostavština u jednoj rečenici.'],
  ],
  org: [
    ['Osnivanje', 'nastanak je vezan uz određeno vrijeme i viziju osnivača.'],
    ['Osnivači', 'iza nje stoje prepoznatljivi pojedinci.'],
    ['Ključni proizvodi', 'iza nje stoje proizvodi i tehnologije s velikim utjecajem.'],
    ['Tehnološki doprinos', 'pridonijela je temeljnim tehnologijama.'],
    ['Utjecaj na industriju', 'oblikovala je smjer razvoja tehnologije i tržišta.'],
    ['Istraživanje i razvoj', 'ulagala je u istraživanje i inovacije.'],
    ['Tržišni položaj', 'zauzima prepoznatljivo mjesto na tržištu.'],
    ['Kultura i praksa', 'iznjedrila je prepoznatljive radne prakse.'],
    ['Kontroverze', 'kroz povijest je imala i sporne trenutke.'],
    ['Današnji status', 'i danas ima ulogu u tehnološkom ekosustavu.'],
    ['Akvizicije i partnerstva', 'rasla je kroz suradnje i preuzimanja.'],
    ['Standardi', 'sudjelovala je u oblikovanju industrijskih standarda.'],
    ['Globalna prisutnost', 'posluje na tržištima diljem svijeta.'],
    ['Naslijeđe', 'ostavila je trajan trag u struci.'],
    ['Ljudi', 'okupljala je utjecajne inženjere i istraživače.'],
    ['Sažetak', 'ključna uloga u jednoj rečenici.'],
  ],
  event: [
    ['Kontekst', 'dogodio se u određenom tehnološkom i društvenom trenutku.'],
    ['Značaj', 'označava prekretnicu u razvoju tehnologije.'],
    ['Posljedice', 'utjecao je na sve što je uslijedilo.'],
    ['Sudionici', 'uz njega se vežu prepoznatljivi akteri.'],
    ['Pozadina', 'prethodili su mu određeni uvjeti i potrebe.'],
    ['Reakcije', 'izazvao je odjek u javnosti i struci.'],
    ['Dugoročni utjecaj', 'njegove posljedice osjećaju se i danas.'],
    ['Povezani događaji', 'dio je šireg niza prekretnica.'],
    ['Pouke', 'iz njega struka izvlači trajne pouke.'],
    ['Zanimljivost', 'uz njega se vežu zanimljive činjenice.'],
    ['Sažetak', 'ključna poruka u jednoj rečenici.'],
  ],
}

// Tier-2 detalji (sigurnosna mreža ako tier-1 ne dosegne cilj)
const DETAILS = [
  ['Pojašnjenje', (e, a) => `Dodatno pojašnjenje teme „${a}” u kontekstu: ${e}.`],
  ['Primjer', (e, a) => `Ilustrativni primjer za „${a}” kod: ${e}.`],
  ['Napomena', (e, a) => `Praktična napomena vezana uz „${a}”: ${e}.`],
  ['Povezano', (e, a) => `Povezani aspekti teme „${a}” za: ${e}.`],
]

function entityName(label) {
  const idx = label.indexOf(': ')
  let s = idx >= 0 ? label.slice(idx + 2) : label
  // ukloni eventualni " — " sufiks
  const dash = s.indexOf(' — ')
  if (dash >= 0) s = s.slice(0, dash)
  return s
}

function collectExpandable(node, out) {
  if (node.kind && ASPECTS[node.kind]) out.push(node)
  if (node.children) for (const ch of node.children) collectExpandable(ch, out)
  return out
}

function expandToTarget() {
  let total = countNodes(ROOT)
  const entities = collectExpandable(ROOT, [])

  // Tier 1: dodaj aspekte svakom entitetu (round-robin) dok ne dosegnemo cilj.
  const aspectNodes = [] // za eventualni tier-2
  let round = 0
  let progressed = true
  while (total < TARGET && progressed) {
    progressed = false
    for (const node of entities) {
      if (total >= TARGET) break
      const pool = ASPECTS[node.kind]
      if (round >= pool.length) continue
      const [title, tail] = pool[round]
      const name = entityName(node.label)
      const aNode = N(`${title}: ${name}`, {
        cat: node.cat === 'root' ? 'note' : node.cat,
        summary: `${name} ${tail}`,
        _entity: name, _aspect: title,
      })
      node.children.push(aNode)
      aspectNodes.push(aNode)
      total++
      progressed = true
    }
    round++
  }

  // Tier 2 (rijetko): dodaj detalje aspektnim čvorovima dok ne dosegnemo cilj.
  let d = 0
  progressed = true
  while (total < TARGET && progressed) {
    progressed = false
    for (const aNode of aspectNodes) {
      if (total >= TARGET) break
      if (d >= DETAILS.length) break
      const [title, fn] = DETAILS[d]
      if (!aNode.children) aNode.children = []
      aNode.children.push(N(`${title}: ${aNode._aspect}`, { cat: 'note', summary: fn(aNode._entity, aNode._aspect) }))
      total++
      progressed = true
    }
    d++
  }
  return total
}

const finalCount = expandToTarget()
if (finalCount !== TARGET) console.warn(`⚠ Dosegnuto ${finalCount} čvorova (cilj ${TARGET}).`)

// ───────────────────────────────────────────────────────────────────────────
//  RASPORED + STIL + SERIJALIZACIJA  (isto kao SE generator)
// ───────────────────────────────────────────────────────────────────────────
function computeLeaves(node) {
  if (!node.children || node.children.length === 0) { node._leaves = 1; return 1 }
  let s = 0
  for (const ch of node.children) s += computeLeaves(ch)
  node._leaves = s
  return s
}
computeLeaves(ROOT)

function computeDepth(node, dd = 0) {
  node._depth = dd
  let max = dd
  if (node.children) for (const ch of node.children) max = Math.max(max, computeDepth(ch, dd + 1))
  return max
}
const MAX_DEPTH = computeDepth(ROOT)

const L = ROOT._leaves
const MIN_ARC = 90
const RING_STEP = Math.max(1400, (L * MIN_ARC) / (2 * Math.PI * MAX_DEPTH))

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
      layout(ch, a, a + span * frac)
      a += span * frac
    }
  }
}
layout(ROOT, 0, 2 * Math.PI)

function styleFor(node) {
  const d = node._depth
  const color = CAT[node.cat] || CAT.note
  if (d === 0) return { shape: 'pill', fillColor: '#04201E', borderColor: color, borderWidth: 3, textColor: '#FAFAFA', fontSize: 30, fontWeight: 800, shadowEnabled: true, glowEnabled: true }
  if (d === 1) return { shape: 'rounded', fillColor: '#141416', borderColor: color, borderWidth: 2.5, textColor: '#FAFAFA', fontSize: 20, fontWeight: 700, shadowEnabled: true, glowEnabled: false }
  if (d === 2) return { shape: 'rounded', fillColor: '#111113', borderColor: color, borderWidth: 1.75, textColor: '#FAFAFA', fontSize: 15, fontWeight: 600, shadowEnabled: true, glowEnabled: false }
  return { shape: 'rectangle', fillColor: '#0D0D0F', borderColor: '#27272A', borderWidth: 1, textColor: '#D4D4D8', fontSize: 12, fontWeight: 500, shadowEnabled: false, glowEnabled: false }
}

function sizeFor(node) {
  const d = node._depth
  const len = node.label.length
  const fs = d === 0 ? 30 : d === 1 ? 20 : d === 2 ? 15 : 12
  const w = Math.min(560, Math.max(d <= 1 ? 200 : 130, Math.round(len * fs * 0.62) + 36))
  const h = d === 0 ? 92 : d === 1 ? 60 : d === 2 ? 46 : 36
  return { width: w, height: h }
}

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
    id, type: 'text',
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
    createdAt: t, updatedAt: t,
  }
  if (!parentDbId) delete dbNode.parentId
  nodes.push(dbNode)

  if (parentDbId) {
    const d = node._depth
    edges.push({
      id: 'e' + (edgeSeq++).toString(36),
      sourceId: parentDbId, targetId: id,
      style: {
        type: 'bezier',
        strokeColor: d <= 1 ? (CAT[node.cat] || '#3A3A40') : '#26262B',
        strokeWidth: Math.max(0.6, 2.6 - d * 0.6),
        arrowStart: 'none', arrowEnd: 'none', animated: false,
      },
      createdAt: t, updatedAt: t,
    })
  }
  if (node.children) for (const ch of node.children) serialize(ch, id)
  return id
}

const rootId = serialize(ROOT, null)

const doc = {
  id: `tehnologija-${SIZE_LABEL}-` + baseTime.toString(36),
  title: `Tehnologija — povijest i sadašnjost (${SIZE_LABEL})`,
  nodes, edges,
  camera: { x: 0, y: 0, zoom: 0.032 },
  rootNodeId: rootId,
  settings: {
    gridEnabled: true, gridSize: 32, snapToGrid: false, backgroundColor: '#0D0D0F',
    defaultNodeStyle: { shape: 'rounded', fillColor: '#111113', borderColor: '#27272A', borderWidth: 1.5, textColor: '#FAFAFA', fontSize: 14, fontWeight: 500, shadowEnabled: true, glowEnabled: false },
    defaultEdgeStyle: { type: 'bezier', strokeColor: '#2A2A30', strokeWidth: 2, arrowStart: 'none', arrowEnd: 'arrow', animated: false },
  },
  createdAt: baseTime, updatedAt: baseTime,
  tags: ['povijest', 'tehnologija', 'inženjerstvo', 'hrvatski', '20k'],
}

writeFileSync(OUT, JSON.stringify(doc))

console.log('✓ Generirano:')
console.log('  čvorova:', nodes.length)
console.log('  bridova:', edges.length)
console.log('  grana (1. razina):', BRANCHES.length)
console.log('  max dubina:', MAX_DEPTH)
console.log('  RING_STEP:', Math.round(RING_STEP), 'px')
console.log('  datoteka:', OUT)
console.log('  veličina:', (Buffer.byteLength(JSON.stringify(doc)) / 1024 / 1024).toFixed(2), 'MB')
