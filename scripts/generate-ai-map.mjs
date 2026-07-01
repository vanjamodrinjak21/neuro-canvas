// scripts/generate-ai-map.mjs
//
// Generira NeuroCanvas mapu (.json) o UMJETNOJ INTELIGENCIJI — povijest,
// temelji i suvremeno stanje — na hrvatskom jeziku, s točno 20 000 čvorova.
//
// Uže usmjereno na AI/ML, s gustom kuriranom jezgrom stvarnih činjenica
// (vremenska crta, područja, ML/DL koncepti, arhitekture, stvarni modeli,
// algoritmi, matematika, okviri, skupovi podataka, mjerila, hardver,
// primjene, etika/sigurnost, agentski sustavi, ljudi i laboratoriji) +
// AI-specifično proširenje pod-aspektima do točno 20 000 čvorova.
//
// Format izlaza odgovara DBMapDocument / parseMapJson (app/utils/mapImport.ts).
// Pokretanje: node scripts/generate-ai-map.mjs
// Izlaz:      umjetna-inteligencija-20k.json  (korijen repo-a)

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Broj čvorova preko CLI-a: `node scripts/generate-ai-map.mjs 10000` (zadano 10000).
// App pouzdano učitava ~10k čvorova; veće mape blokiraju glavnu dretvu pri učitavanju.
const TARGET = Number(process.argv[2]) || 10000
const SIZE_LABEL = Math.round(TARGET / 1000) + 'k'
const OUT = join(__dirname, '..', `umjetna-inteligencija-${SIZE_LABEL}.json`)

const CAT = {
  root: '#00D2BE', concept: '#60A5FA', fact: '#4ADE80', question: '#FACC15',
  example: '#FB923C', definition: '#A78BFA', process: '#F472B6', note: '#71717A',
}
let _uid = 0
const nid = () => 'a' + (_uid++).toString(36)
const N = (label, opts = {}) => ({ label, ...opts })

// ───────────────────────────────────────────────────────────────────────────
//  KURIRANI PODACI (stvarne činjenice o umjetnoj inteligenciji)
// ───────────────────────────────────────────────────────────────────────────

// Vremenska crta AI-a [godina, naslov, opis]
const TIMELINE = [
  ['1943', 'Model neurona (McCulloch–Pitts)', 'Prvi matematički model umjetnog neurona.'],
  ['1950', 'Turingov test', 'Alan Turing postavlja pitanje "Mogu li strojevi misliti?".'],
  ['1956', 'Konferencija u Dartmouthu', 'Skovan pojam "umjetna inteligencija"; rođenje područja.'],
  ['1957', 'Perceptron', 'Frank Rosenblatt gradi prvi učeći neuronski model.'],
  ['1959', 'Pojam "strojno učenje"', 'Arthur Samuel uvodi pojam radeći na igri dame.'],
  ['1965', 'ELIZA', 'Joseph Weizenbaum stvara prvi chatbot.'],
  ['1969', 'Knjiga "Perceptrons"', 'Minsky i Papert ukazuju na ograničenja; slijedi prva "AI zima".'],
  ['1972', 'MYCIN', 'Ekspertni sustav za medicinsku dijagnostiku.'],
  ['1980', 'Neocognitron', 'Kunihiko Fukushima — preteča konvolucijskih mreža.'],
  ['1986', 'Propagacija unatrag', 'Rumelhart, Hinton i Williams populariziraju backpropagation.'],
  ['1989', 'LeNet', 'Yann LeCun primjenjuje CNN na prepoznavanje znamenki.'],
  ['1997', 'Deep Blue pobjeđuje Kasparova', 'IBM-ovo računalo nadmašuje svjetskog prvaka u šahu.'],
  ['1997', 'LSTM', 'Hochreiter i Schmidhuber rješavaju problem dugoročnog pamćenja.'],
  ['2006', 'Oživljavanje dubokog učenja', 'Hinton i suradnici pokazuju duboke mreže vjerovanja.'],
  ['2009', 'ImageNet', 'Fei-Fei Li gradi golemi skup označenih slika.'],
  ['2011', 'Watson pobjeđuje u Jeopardyju', 'IBM Watson pobjeđuje ljudske prvake.'],
  ['2012', 'AlexNet', 'Proboj dubokog učenja na ImageNet natjecanju.'],
  ['2013', 'Word2Vec', 'Mikolov i suradnici uvode učinkovita ugrađivanja riječi.'],
  ['2013', 'DQN (Atari)', 'DeepMind uči igrati Atari igre iz piksela.'],
  ['2014', 'Generativne suparničke mreže (GAN)', 'Ian Goodfellow uvodi GAN-ove.'],
  ['2014', 'Seq2seq i Adam', 'Modeli prevođenja i popularni optimizator Adam.'],
  ['2015', 'ResNet i TensorFlow', 'Rezidualne mreže i Googleov okvir za duboko učenje.'],
  ['2016', 'AlphaGo pobjeđuje Lee Sedola', 'DeepMind svladava igru Go.'],
  ['2017', '"Attention Is All You Need"', 'Predstavljen Transformer — temelj moderne ere.'],
  ['2018', 'BERT i GPT-1', 'Predtrenirani jezični modeli mijenjaju NLP.'],
  ['2019', 'GPT-2', 'Veliki jezični model snažnih generativnih sposobnosti.'],
  ['2020', 'GPT-3 i AlphaFold 2', 'Model sa 175 milijardi parametara; proboj u savijanju proteina.'],
  ['2021', 'DALL·E, CLIP i Copilot', 'Tekst-u-sliku, povezivanje slike i teksta, AI za kod.'],
  ['2022', 'ChatGPT, Stable Diffusion, Whisper', 'Generativni AI ulazi u širu javnost.'],
  ['2023', 'GPT-4, Claude, Gemini, LLaMA', 'Snažni multimodalni i otvoreni modeli.'],
  ['2024', 'AI agenti i multimodalnost', 'Autonomni agenti i modeli koji rade s tekstom, slikom i zvukom.'],
]

// Područja AI-a [naziv, opis]
const AREAS = [
  ['Strojno učenje', 'Sustavi koji uče iz podataka bez eksplicitnog programiranja.'],
  ['Duboko učenje', 'Strojno učenje pomoću dubokih neuronskih mreža.'],
  ['Obrada prirodnog jezika', 'Razumijevanje i generiranje ljudskog jezika.'],
  ['Računalni vid', 'Razumijevanje slika i videa.'],
  ['Prepoznavanje govora', 'Pretvorba govora u tekst i obrnuto.'],
  ['Robotika', 'Inteligentno upravljanje fizičkim strojevima.'],
  ['Potkrepljeno učenje', 'Učenje optimalnog ponašanja kroz nagrade.'],
  ['Ekspertni sustavi', 'Rana AI temeljena na pravilima i znanju.'],
  ['Planiranje i pretraga', 'Algoritmi za donošenje odluka i rješavanje problema.'],
  ['Reprezentacija znanja', 'Formalno bilježenje znanja za rasuđivanje.'],
  ['Generativni AI', 'Stvaranje novog sadržaja: teksta, slika, zvuka, koda.'],
  ['Multimodalni AI', 'Modeli koji povezuju više vrsta podataka.'],
  ['Afektivno računarstvo', 'Prepoznavanje i modeliranje emocija.'],
  ['Preporučni sustavi', 'Predviđanje korisničkih preferencija.'],
  ['Optimizacija', 'Pronalazak najboljih rješenja u zadanom prostoru.'],
  ['Sigurnost i poravnanje', 'Usklađivanje AI sustava s ljudskim vrijednostima.'],
]

// ML koncepti [naziv, opis]
const MLCONCEPTS = [
  ['Nadzirano učenje', 'Učenje iz označenih primjera (ulaz–izlaz).'],
  ['Nenadzirano učenje', 'Pronalazak strukture u neoznačenim podacima.'],
  ['Polunadzirano učenje', 'Kombinacija označenih i neoznačenih podataka.'],
  ['Samonadzirano učenje', 'Model sam stvara nadzorne signale iz podataka.'],
  ['Potkrepljeno učenje', 'Učenje kroz interakciju i nagrade.'],
  ['Prijenosno učenje', 'Prenošenje znanja s jednog zadatka na drugi.'],
  ['Fino podešavanje', 'Prilagodba predtreniranog modela novom zadatku.'],
  ['Klasifikacija', 'Razvrstavanje primjera u kategorije.'],
  ['Regresija', 'Predviđanje kontinuirane vrijednosti.'],
  ['Grupiranje (klasteriranje)', 'Grupiranje sličnih primjera.'],
  ['Smanjenje dimenzionalnosti', 'Sažimanje podataka uz očuvanje informacije.'],
  ['Prenaučenost (overfitting)', 'Model pamti podatke umjesto da generalizira.'],
  ['Podnaučenost (underfitting)', 'Model je prejednostavan za podatke.'],
  ['Kompromis pristranost–varijanca', 'Ravnoteža između pogreške i osjetljivosti.'],
  ['Regularizacija', 'Tehnike protiv prenaučenosti (L1, L2).'],
  ['Unakrsna validacija', 'Procjena modela na više podjela podataka.'],
  ['Značajke (features)', 'Ulazne varijable koje opisuju primjer.'],
  ['Inženjering značajki', 'Stvaranje korisnih ulaznih varijabli.'],
  ['Skup za treniranje i test', 'Podjela podataka za učenje i procjenu.'],
  ['Generalizacija', 'Sposobnost modela na novim podacima.'],
  ['Hiperparametri', 'Postavke učenja izvan samog modela.'],
  ['Augmentacija podataka', 'Umjetno proširenje skupa podataka.'],
  ['Neravnoteža klasa', 'Nejednaka zastupljenost kategorija.'],
  ['Curenje podataka', 'Nehotično propuštanje informacija iz testa.'],
]

// Algoritmi nadziranog/klasičnog ML-a [naziv, godina, autor, opis]
const ALGOS = [
  ['Linearna regresija', '—', 'klasika', 'Modelira linearni odnos varijabli.'],
  ['Logistička regresija', '—', 'klasika', 'Klasifikacija pomoću logističke funkcije.'],
  ['Stabla odluke', '—', 'Quinlan i dr.', 'Hijerarhijska pravila za odlučivanje.'],
  ['Slučajne šume', '2001', 'Leo Breiman', 'Ansambl stabala za robusne predikcije.'],
  ['Gradijentno pojačavanje', '—', 'Friedman', 'Sekvencijalno učenje slabih modela.'],
  ['XGBoost', '2014', 'Chen i Guestrin', 'Učinkovito pojačavanje, čest pobjednik natjecanja.'],
  ['Metoda potpornih vektora (SVM)', '1995', 'Cortes i Vapnik', 'Pronalazak optimalne razdjelne granice.'],
  ['k-najbližih susjeda (k-NN)', '—', 'klasika', 'Klasifikacija prema najbližim primjerima.'],
  ['Naivni Bayes', '—', 'klasika', 'Vjerojatnosni klasifikator uz neovisnost značajki.'],
  ['k-srednjih vrijednosti (k-means)', '—', 'MacQueen', 'Grupiranje u k klastera.'],
  ['DBSCAN', '1996', 'Ester i dr.', 'Grupiranje temeljeno na gustoći.'],
  ['Hijerarhijsko grupiranje', '—', 'klasika', 'Gradnja stabla klastera.'],
  ['Analiza glavnih komponenti (PCA)', '1901', 'Pearson', 'Smanjenje dimenzija projekcijom.'],
  ['t-SNE', '2008', 'van der Maaten i Hinton', 'Vizualizacija visokodimenzionalnih podataka.'],
  ['UMAP', '2018', 'McInnes i dr.', 'Brza redukcija dimenzionalnosti.'],
  ['Apriori', '1994', 'Agrawal i Srikant', 'Otkrivanje čestih skupova i pravila.'],
  ['Skriveni Markovljevi modeli', '—', 'Baum i dr.', 'Modeliranje sekvencijalnih podataka.'],
  ['Gaussove mješavine (GMM)', '—', 'klasika', 'Vjerojatnosno grupiranje.'],
  ['AdaBoost', '1995', 'Freund i Schapire', 'Pojačavanje težinom pogrešno klasificiranih.'],
  ['Ansambli (bagging/boosting)', '—', 'razni', 'Kombiniranje više modela za bolji rezultat.'],
]

// Koncepti dubokog učenja [naziv, opis]
const DLCONCEPTS = [
  ['Umjetni neuron', 'Osnovna jedinica koja zbraja ulaze i primjenjuje aktivaciju.'],
  ['Aktivacijska funkcija', 'Uvodi nelinearnost (ReLU, sigmoid, tanh).'],
  ['ReLU', 'Najčešća aktivacija; propušta pozitivne vrijednosti.'],
  ['Softmax', 'Pretvara izlaze u vjerojatnosti klasa.'],
  ['Propagacija unaprijed', 'Računanje izlaza mreže iz ulaza.'],
  ['Propagacija unatrag', 'Računanje gradijenata za učenje težina.'],
  ['Funkcija gubitka', 'Mjera pogreške koju model minimizira.'],
  ['Gradijentni spust', 'Iterativno smanjivanje gubitka.'],
  ['Stohastički gradijentni spust', 'Učenje na nasumičnim mini-serijama.'],
  ['Optimizator Adam', 'Prilagodljive stope učenja po parametru.'],
  ['Stopa učenja', 'Veličina koraka pri ažuriranju težina.'],
  ['Mini-serija (batch)', 'Skupina primjera u jednom koraku učenja.'],
  ['Epoha', 'Jedan prolazak kroz cijeli skup za treniranje.'],
  ['Dropout', 'Slučajno isključivanje neurona protiv prenaučenosti.'],
  ['Normalizacija serije', 'Stabilizacija i ubrzanje treniranja.'],
  ['Nestajući gradijent', 'Gradijenti postaju premali u dubokim mrežama.'],
  ['Eksplodirajući gradijent', 'Gradijenti postaju preveliki i destabiliziraju učenje.'],
  ['Inicijalizacija težina', 'Početne vrijednosti ključne za učenje.'],
  ['Ugrađivanja (embeddings)', 'Gusti vektorski prikazi značenja.'],
  ['Pažnja (attention)', 'Mehanizam fokusiranja na važne dijelove ulaza.'],
  ['Samopažnja', 'Element povezuje se s drugim elementima iste sekvence.'],
  ['Predtreniranje', 'Učenje općih obrazaca na velikim podacima.'],
  ['Destilacija znanja', 'Prijenos znanja s velikog na mali model.'],
  ['Kvantizacija', 'Smanjenje preciznosti radi bržeg rada.'],
]

// Arhitekture neuronskih mreža [naziv, opis]
const ARCH = [
  ['Perceptron', 'Najjednostavnija neuronska jedinica.'],
  ['Višeslojni perceptron (MLP)', 'Potpuno povezana mreža s skrivenim slojevima.'],
  ['Konvolucijska mreža (CNN)', 'Mreža za slike s konvolucijskim slojevima.'],
  ['Rekurentna mreža (RNN)', 'Mreža za sekvencijalne podatke.'],
  ['LSTM', 'Rekurentna mreža s dugoročnim pamćenjem.'],
  ['GRU', 'Jednostavnija varijanta LSTM-a.'],
  ['Transformer', 'Arhitektura temeljena na mehanizmu pažnje.'],
  ['Enkoder–dekoder', 'Arhitektura za prevođenje sekvenci.'],
  ['Autoenkoder', 'Mreža koja uči sažeti prikaz podataka.'],
  ['Varijacijski autoenkoder (VAE)', 'Generativni model s vjerojatnosnim latentnim prostorom.'],
  ['Generativna suparnička mreža (GAN)', 'Generator i diskriminator u igri.'],
  ['Difuzijski model', 'Generiranje postupnim uklanjanjem šuma.'],
  ['ResNet', 'Rezidualne veze za vrlo duboke mreže.'],
  ['U-Net', 'Mreža za segmentaciju s preskočnim vezama.'],
  ['Vision Transformer (ViT)', 'Transformer primijenjen na slike.'],
  ['Mreža s grafovima (GNN)', 'Učenje na grafovskim strukturama.'],
  ['Mješavina eksperata (MoE)', 'Aktiviranje dijela mreže po ulazu.'],
  ['Mreža pažnje (Attention)', 'Slojevi koji teže važnim dijelovima ulaza.'],
  ['Siamese mreža', 'Mreža za usporedbu parova ulaza.'],
  ['Capsule mreže', 'Mreže koje čuvaju prostorne odnose.'],
  ['Inception', 'Mreža s paralelnim konvolucijama različitih veličina.'],
  ['EfficientNet', 'Skalabilna i učinkovita CNN arhitektura.'],
  ['Seq2seq', 'Model sekvenca-u-sekvencu s enkoderom i dekoderom.'],
  ['BiLSTM', 'Dvosmjerni LSTM za bogatiji kontekst.'],
]

// Stvarni modeli i sustavi [naziv, godina, tvorac, opis]
const MODELS = [
  ['GPT-1', '2018', 'OpenAI', 'Prvi generativni predtrenirani transformer.'],
  ['GPT-2', '2019', 'OpenAI', 'Veći model snažnih generativnih sposobnosti.'],
  ['GPT-3', '2020', 'OpenAI', 'Model sa 175 milijardi parametara.'],
  ['GPT-4', '2023', 'OpenAI', 'Snažan multimodalni model.'],
  ['ChatGPT', '2022', 'OpenAI', 'Razgovorni asistent koji je popularizirao generativni AI.'],
  ['Claude', '2023', 'Anthropic', 'Obitelj modela s naglaskom na sigurnost i korisnost.'],
  ['Gemini', '2023', 'Google DeepMind', 'Multimodalna obitelj modela.'],
  ['LLaMA', '2023', 'Meta', 'Otvoreni veliki jezični modeli.'],
  ['Mistral', '2023', 'Mistral AI', 'Učinkoviti otvoreni modeli.'],
  ['PaLM', '2022', 'Google', 'Veliki jezični model s 540 milijardi parametara.'],
  ['BERT', '2018', 'Google', 'Dvosmjerni enkoderski model za razumijevanje teksta.'],
  ['RoBERTa', '2019', 'Meta', 'Robusnije optimiziran BERT.'],
  ['T5', '2019', 'Google', 'Sve zadatke svodi na tekst-u-tekst.'],
  ['BLOOM', '2022', 'BigScience', 'Otvoreni višejezični model.'],
  ['Whisper', '2022', 'OpenAI', 'Model za prepoznavanje govora.'],
  ['CLIP', '2021', 'OpenAI', 'Povezivanje slika i teksta.'],
  ['DALL·E', '2021', 'OpenAI', 'Generiranje slika iz teksta.'],
  ['DALL·E 2', '2022', 'OpenAI', 'Realističnije generiranje slika.'],
  ['Stable Diffusion', '2022', 'Stability AI', 'Otvoreni difuzijski model za slike.'],
  ['Midjourney', '2022', 'Midjourney', 'Generator umjetničkih slika.'],
  ['Imagen', '2022', 'Google', 'Visokokvalitetno generiranje slika.'],
  ['Sora', '2024', 'OpenAI', 'Generiranje videa iz teksta.'],
  ['AlexNet', '2012', 'Krizhevsky i dr.', 'CNN koja je pokrenula proboj dubokog učenja.'],
  ['AlphaGo', '2016', 'DeepMind', 'Pobijedio svjetskog prvaka u igri Go.'],
  ['AlphaZero', '2017', 'DeepMind', 'Učenje igara bez ljudskih podataka.'],
  ['MuZero', '2019', 'DeepMind', 'Planiranje bez poznatih pravila igre.'],
  ['AlphaFold', '2020', 'DeepMind', 'Proboj u predviđanju strukture proteina.'],
  ['AlphaStar', '2019', 'DeepMind', 'Svladao složenu strategijsku igru.'],
  ['DQN', '2013', 'DeepMind', 'Učenje Atari igara iz piksela.'],
  ['Word2Vec', '2013', 'Google', 'Ugrađivanja riječi učinkovitim treniranjem.'],
  ['GloVe', '2014', 'Stanford', 'Ugrađivanja temeljena na statistici supojavljivanja.'],
  ['Deep Blue', '1997', 'IBM', 'Šahovsko računalo koje je pobijedilo Kasparova.'],
  ['Watson', '2011', 'IBM', 'Sustav koji je pobijedio u Jeopardyju.'],
  ['ELIZA', '1965', 'Weizenbaum', 'Rani chatbot koji oponaša terapeuta.'],
]

// Obrada prirodnog jezika [naziv, opis]
const NLP = [
  ['Tokenizacija', 'Razbijanje teksta na manje jedinice.'],
  ['Ugrađivanja riječi', 'Vektorski prikazi značenja riječi.'],
  ['Vrećica riječi (BoW)', 'Prikaz teksta brojem pojavljivanja riječi.'],
  ['TF-IDF', 'Težinski prikaz važnosti riječi.'],
  ['Jezično modeliranje', 'Predviđanje sljedeće riječi u nizu.'],
  ['Strojno prevođenje', 'Automatski prijevod među jezicima.'],
  ['Prepoznavanje imenovanih entiteta', 'Pronalazak imena, mjesta, organizacija.'],
  ['Označavanje vrsta riječi', 'Određivanje gramatičke uloge riječi.'],
  ['Analiza sentimenta', 'Procjena emocionalnog tona teksta.'],
  ['Sažimanje teksta', 'Stvaranje kraćeg sažetka.'],
  ['Odgovaranje na pitanja', 'Pronalazak odgovora iz teksta.'],
  ['Klasifikacija teksta', 'Razvrstavanje dokumenata u kategorije.'],
  ['Generiranje teksta', 'Stvaranje suvislog teksta.'],
  ['Razrješavanje koreferencije', 'Povezivanje zamjenica s entitetima.'],
  ['Sintaktička analiza', 'Razlaganje rečenične strukture.'],
  ['Prepoznavanje govora', 'Pretvorba zvuka u tekst.'],
  ['Sinteza govora', 'Pretvorba teksta u govor.'],
  ['Dijaloški sustavi', 'Razgovorni agenti i asistenti.'],
  ['Potkword tokenizacija (BPE)', 'Razbijanje na podriječi za rjeđe pojmove.'],
  ['Kontekstualna ugrađivanja', 'Prikazi ovisni o kontekstu rečenice.'],
  ['Prompt inženjering', 'Oblikovanje uputa za jezične modele.'],
  ['Učenje s malo primjera', 'Rješavanje zadataka uz nekoliko primjera.'],
  ['Lanac misli (chain-of-thought)', 'Poticanje modela na korake rasuđivanja.'],
  ['Halucinacije', 'Uvjerljiv ali netočan sadržaj modela.'],
]

// Računalni vid [naziv, opis]
const VISION = [
  ['Klasifikacija slika', 'Određivanje kategorije slike.'],
  ['Detekcija objekata', 'Pronalazak i lociranje objekata.'],
  ['Semantička segmentacija', 'Označavanje svakog piksela klasom.'],
  ['Instancijska segmentacija', 'Razlikovanje pojedinačnih objekata.'],
  ['Prepoznavanje lica', 'Identifikacija osoba sa slika.'],
  ['Procjena poze', 'Određivanje položaja tijela ili zglobova.'],
  ['Optički tok', 'Procjena kretanja između sličica.'],
  ['Praćenje objekata', 'Slijeđenje objekata kroz video.'],
  ['Generiranje slika', 'Stvaranje novih slika.'],
  ['Super-rezolucija', 'Povećanje razlučivosti slike.'],
  ['Prijenos stila', 'Primjena stila jedne slike na drugu.'],
  ['OCR', 'Prepoznavanje teksta sa slika.'],
  ['Konvolucija', 'Operacija izvlačenja značajki iz slike.'],
  ['Sažimanje (pooling)', 'Smanjenje dimenzija mape značajki.'],
  ['YOLO', 'Brza detekcija objekata u jednom prolazu.'],
  ['R-CNN obitelj', 'Detekcija putem regija interesa.'],
  ['Mape značajki', 'Izlazi konvolucijskih slojeva.'],
  ['Augmentacija slika', 'Rotacije, izrezi i transformacije za učenje.'],
  ['Detekcija rubova', 'Pronalazak granica u slici.'],
  ['3D vid', 'Razumijevanje dubine i prostora.'],
  ['Medicinska analiza slika', 'Dijagnostika iz snimaka.'],
  ['Vizualno odgovaranje na pitanja', 'Odgovori na pitanja o slikama.'],
]

// Potkrepljeno učenje [naziv, opis]
const RL = [
  ['Agent', 'Subjekt koji uči donositi odluke.'],
  ['Okolina', 'Sustav s kojim agent komunicira.'],
  ['Nagrada', 'Signal kvalitete poduzete radnje.'],
  ['Politika (policy)', 'Strategija odabira radnji.'],
  ['Funkcija vrijednosti', 'Procjena buduće nagrade iz stanja.'],
  ['Markovljev proces odlučivanja', 'Formalni okvir za RL.'],
  ['Q-učenje', 'Učenje vrijednosti parova stanje–radnja.'],
  ['Duboki Q (DQN)', 'Q-učenje pomoću neuronske mreže.'],
  ['Gradijent politike', 'Izravno učenje politike.'],
  ['Akter–kritičar', 'Kombinacija politike i vrijednosti.'],
  ['PPO', 'Stabilni algoritam optimizacije politike.'],
  ['A3C', 'Asinkroni akter–kritičar.'],
  ['Istraživanje vs iskorištavanje', 'Ravnoteža isprobavanja i korištenja znanja.'],
  ['Monte Carlo pretraga stabla', 'Planiranje uzorkovanjem mogućih poteza.'],
  ['Učenje s ljudskim povratom (RLHF)', 'Usklađivanje modela s ljudskim preferencijama.'],
  ['Diskontni faktor', 'Težina budućih nagrada.'],
  ['Model okoline', 'Naučeni prikaz dinamike okoline.'],
  ['Bellmanova jednadžba', 'Temeljna rekurzija vrijednosti.'],
  ['Igre kao mjerilo', 'Igre kao testno okruženje za RL.'],
  ['Robotsko upravljanje', 'RL za kretanje i manipulaciju.'],
]

// Generativni modeli [naziv, opis]
const GENERATIVE = [
  ['Generator', 'Mreža koja stvara nove uzorke.'],
  ['Diskriminator', 'Mreža koja razlikuje stvarno od lažnog.'],
  ['Uvjetni GAN', 'Generiranje pod zadanim uvjetom.'],
  ['StyleGAN', 'Generiranje vrlo realističnih lica.'],
  ['CycleGAN', 'Prijevod slika bez uparenih primjera.'],
  ['Difuzijski proces', 'Postupno dodavanje i uklanjanje šuma.'],
  ['Latentna difuzija', 'Difuzija u sažetom latentnom prostoru.'],
  ['Autoregresivni modeli', 'Generiranje element po element.'],
  ['Tekst u sliku', 'Stvaranje slika iz opisa.'],
  ['Tekst u video', 'Stvaranje videa iz opisa.'],
  ['Tekst u zvuk', 'Generiranje govora i glazbe.'],
  ['Latentni prostor', 'Sažeti prikaz iz kojeg se generira.'],
  ['Uzorkovanje', 'Izvlačenje novih primjera iz modela.'],
  ['Vođenje (guidance)', 'Usmjeravanje generiranja prema uvjetu.'],
  ['Inpainting', 'Popunjavanje dijelova slike.'],
  ['Prijenos lica (deepfake)', 'Zamjena lica u videu.'],
  ['Sinteza glasa', 'Umjetno stvaranje govora.'],
  ['Generiranje koda', 'Stvaranje programskog koda.'],
  ['Mod kolaps', 'GAN generira premalo raznolikosti.'],
  ['Procjena kvalitete (FID)', 'Mjera kvalitete generiranih slika.'],
]

// Matematički temelji [naziv, opis]
const MATH = [
  ['Linearna algebra', 'Vektori, matrice i transformacije.'],
  ['Matrice i tenzori', 'Strukture podataka za neuronske mreže.'],
  ['Množenje matrica', 'Temeljna operacija u mrežama.'],
  ['Svojstvene vrijednosti', 'Karakteristike linearnih transformacija.'],
  ['Diferencijalni račun', 'Derivacije i promjene funkcija.'],
  ['Gradijent', 'Vektor parcijalnih derivacija.'],
  ['Pravilo lanca', 'Temelj propagacije unatrag.'],
  ['Vjerojatnost', 'Modeliranje neizvjesnosti.'],
  ['Bayesov teorem', 'Ažuriranje vjerovanja na temelju dokaza.'],
  ['Distribucije', 'Normalna, Bernoullijeva i druge.'],
  ['Statistika', 'Procjena i zaključivanje iz podataka.'],
  ['Optimizacija', 'Traženje minimuma ili maksimuma funkcije.'],
  ['Konveksnost', 'Svojstvo koje olakšava optimizaciju.'],
  ['Teorija informacije', 'Mjerenje informacije i nesigurnosti.'],
  ['Entropija', 'Mjera neizvjesnosti.'],
  ['Unakrsna entropija', 'Funkcija gubitka za klasifikaciju.'],
  ['KL divergencija', 'Razlika između dviju distribucija.'],
  ['Numerička stabilnost', 'Izbjegavanje grešaka u računanju.'],
  ['Funkcije gubitka', 'Mjere odstupanja predikcije od istine.'],
  ['Procjena maksimalne vjerodostojnosti', 'Odabir parametara koji najbolje objašnjavaju podatke.'],
  ['Stohastička aproksimacija', 'Učenje na uzorcima podataka.'],
  ['Regularizirane norme', 'Kazne za složenost modela.'],
  ['Sigmoidna i softmax funkcija', 'Pretvaranje izlaza u vjerojatnosti.'],
  ['Tenzorsko računanje', 'Operacije nad višedimenzionalnim poljima.'],
]

// Evaluacija i metrike [naziv, opis]
const METRICS = [
  ['Točnost (accuracy)', 'Udio ispravnih predikcija.'],
  ['Preciznost', 'Udio točnih među pozitivnim predikcijama.'],
  ['Odziv (recall)', 'Udio pronađenih stvarnih pozitiva.'],
  ['F1 mjera', 'Harmonijska sredina preciznosti i odziva.'],
  ['Matrica zabune', 'Tablica točnih i pogrešnih predikcija.'],
  ['ROC krivulja i AUC', 'Procjena klasifikatora po pragovima.'],
  ['Srednja kvadratna pogreška (MSE)', 'Prosjek kvadrata odstupanja.'],
  ['Srednja apsolutna pogreška (MAE)', 'Prosjek apsolutnih odstupanja.'],
  ['Koeficijent determinacije (R²)', 'Udio objašnjene varijance.'],
  ['BLEU', 'Mjera kvalitete strojnog prijevoda.'],
  ['ROUGE', 'Mjera kvalitete sažetaka.'],
  ['Perpleksnost', 'Mjera kvalitete jezičnog modela.'],
  ['IoU', 'Preklapanje predviđenog i stvarnog područja.'],
  ['mAP', 'Srednja prosječna preciznost u detekciji.'],
  ['Krivulja učenja', 'Praćenje pogreške tijekom treniranja.'],
  ['Validacijski gubitak', 'Pogreška na neviđenim podacima.'],
  ['Kalibracija', 'Usklađenost vjerojatnosti s ishodima.'],
  ['Mjere pravednosti', 'Procjena pristranosti modela.'],
  ['Ljudska procjena', 'Ocjena kvalitete od strane ljudi.'],
  ['A/B testiranje', 'Usporedba modela u stvarnoj upotrebi.'],
]

// Okviri i alati [naziv, opis]
const TOOLS = [
  ['TensorFlow', 'Googleov okvir za duboko učenje.'],
  ['PyTorch', 'Popularan okvir za istraživanje i produkciju.'],
  ['Keras', 'Visokorazinsko sučelje za neuronske mreže.'],
  ['scikit-learn', 'Knjižnica klasičnog strojnog učenja.'],
  ['JAX', 'Okvir za automatsko deriviranje i ubrzanje.'],
  ['Hugging Face Transformers', 'Knjižnica predtreniranih modela.'],
  ['LangChain', 'Okvir za aplikacije s jezičnim modelima.'],
  ['OpenCV', 'Knjižnica za računalni vid.'],
  ['NLTK', 'Alat za obradu prirodnog jezika.'],
  ['spaCy', 'Brza NLP knjižnica za produkciju.'],
  ['XGBoost', 'Knjižnica za gradijentno pojačavanje.'],
  ['NumPy', 'Numeričko računanje u Pythonu.'],
  ['Pandas', 'Obrada i analiza podataka.'],
  ['Jupyter', 'Interaktivne bilježnice za eksperimente.'],
  ['ONNX', 'Otvoreni format za razmjenu modela.'],
  ['Weights & Biases', 'Praćenje eksperimenata.'],
  ['MLflow', 'Upravljanje životnim ciklusom modela.'],
  ['CUDA', 'Platforma za računanje na GPU-u.'],
  ['Ollama', 'Lokalno pokretanje jezičnih modela.'],
  ['vLLM', 'Učinkovito posluživanje jezičnih modela.'],
  ['Vektorske baze', 'Pohrana i pretraga ugrađivanja.'],
  ['DeepSpeed', 'Optimizacija treniranja velikih modela.'],
]

// Skupovi podataka i mjerila [naziv, opis]
const DATASETS = [
  ['MNIST', 'Rukom pisane znamenke; klasični mjerilo.'],
  ['ImageNet', 'Milijuni označenih slika u tisuće kategorija.'],
  ['CIFAR-10/100', 'Male slike za klasifikaciju.'],
  ['COCO', 'Slike s objektima i opisima.'],
  ['GLUE', 'Skup zadataka za razumijevanje jezika.'],
  ['SuperGLUE', 'Teži nasljednik GLUE-a.'],
  ['SQuAD', 'Mjerilo za odgovaranje na pitanja.'],
  ['MMLU', 'Mjerilo znanja kroz mnoge predmete.'],
  ['HellaSwag', 'Mjerilo zdravorazumskog rasuđivanja.'],
  ['WikiText', 'Korpus za jezično modeliranje.'],
  ['Common Crawl', 'Golemi web korpus za treniranje.'],
  ['LAION', 'Veliki skup parova slika i teksta.'],
  ['Penn Treebank', 'Klasični lingvistički korpus.'],
  ['LibriSpeech', 'Korpus govora za prepoznavanje.'],
  ['Pascal VOC', 'Mjerilo za detekciju objekata.'],
  ['Fashion-MNIST', 'Slike odjevnih predmeta.'],
  ['OpenWebText', 'Otvoreni web korpus.'],
  ['The Pile', 'Raznolik korpus za jezične modele.'],
  ['Kaggle skupovi', 'Skupovi za natjecanja u podatkovnoj znanosti.'],
  ['HumanEval', 'Mjerilo za generiranje koda.'],
]

// Hardver za AI [naziv, opis]
const HARDWARE = [
  ['GPU', 'Paralelni procesor ključan za duboko učenje.'],
  ['TPU', 'Googleov čip za tenzorske operacije.'],
  ['NPU', 'Procesor za neuronske mreže na uređaju.'],
  ['Tensor jezgre', 'Specijalizirane jedinice za množenje matrica.'],
  ['CUDA jezgre', 'Paralelne jedinice na NVIDIA GPU-ima.'],
  ['Distribuirano treniranje', 'Učenje na više uređaja.'],
  ['Paralelizam podataka', 'Dijeljenje serije među uređajima.'],
  ['Paralelizam modela', 'Dijeljenje modela među uređajima.'],
  ['Mješovita preciznost', 'Brže treniranje uz manju preciznost.'],
  ['Rubni AI (Edge)', 'Pokretanje modela na uređajima.'],
  ['Memorijski zid', 'Ograničenje brzine zbog pristupa memoriji.'],
  ['Akceleratori', 'Specijalizirani čipovi za AI.'],
  ['Klasteri za treniranje', 'Velike skupine povezanih GPU-a.'],
  ['Inferencija', 'Pokretanje istreniranog modela.'],
  ['Kvantizacija modela', 'Smanjenje preciznosti za brži rad.'],
  ['Optimizacija inferencije', 'Ubrzanje izvođenja modela.'],
]

// Primjene AI-a [naziv, opis]
const APPLICATIONS = [
  ['Virtualni asistenti', 'Razgovorni pomoćnici poput chatbotova.'],
  ['Strojno prevođenje', 'Automatski prijevod teksta i govora.'],
  ['Preporuke sadržaja', 'Predlaganje filmova, glazbe i proizvoda.'],
  ['Autonomna vožnja', 'Vozila koja samostalno upravljaju.'],
  ['Medicinska dijagnostika', 'Analiza snimaka i podataka pacijenata.'],
  ['Otkrivanje lijekova', 'Ubrzanje razvoja novih lijekova.'],
  ['Otkrivanje prijevara', 'Prepoznavanje sumnjivih transakcija.'],
  ['Generiranje slika', 'Stvaranje umjetničkih i realističnih slika.'],
  ['Generiranje koda', 'Asistenti koji pišu programski kod.'],
  ['Prepoznavanje govora', 'Glasovno upravljanje i transkripcija.'],
  ['Analiza sentimenta', 'Praćenje mišljenja u tekstovima.'],
  ['Robotika u industriji', 'Automatizacija proizvodnje.'],
  ['Personalizirano obrazovanje', 'Prilagodba učenja korisniku.'],
  ['Predviđanje vremena', 'Modeli za meteorologiju.'],
  ['Financijsko predviđanje', 'Analiza tržišta i rizika.'],
  ['Obrada dokumenata', 'Izvlačenje informacija iz teksta.'],
  ['Igre i NPC-i', 'Inteligentno ponašanje u igrama.'],
  ['Sigurnost i nadzor', 'Analiza videa i anomalija.'],
  ['Poljoprivreda', 'Praćenje usjeva i optimizacija prinosa.'],
  ['Pretraživanje i RAG', 'Odgovori temeljeni na dohvaćenom znanju.'],
  ['Kreativno pisanje', 'Pomoć pri stvaranju sadržaja.'],
  ['Personalizirani marketing', 'Ciljanje na temelju ponašanja.'],
  ['Znanstveno istraživanje', 'Ubrzanje otkrića analizom podataka.'],
  ['Pristupačnost', 'Pomoć osobama s invaliditetom.'],
]

// Agentski sustavi i suvremeni AI [naziv, opis]
const AGENTIC = [
  ['AI agenti', 'Autonomni sustavi koji izvode zadatke.'],
  ['Korištenje alata', 'Modeli koji pozivaju vanjske alate.'],
  ['Pozivanje funkcija', 'Strukturirani pozivi prema kodu.'],
  ['RAG', 'Generiranje proširen dohvaćanjem znanja.'],
  ['Vektorske baze', 'Pohrana ugrađivanja za semantičku pretragu.'],
  ['Memorija agenta', 'Pamćenje konteksta kroz interakcije.'],
  ['Planiranje', 'Razlaganje cilja na korake.'],
  ['ReAct', 'Spoj rasuđivanja i djelovanja.'],
  ['Višeagentni sustavi', 'Suradnja više agenata.'],
  ['Orkestracija', 'Koordinacija koraka i alata.'],
  ['Prozor konteksta', 'Količina teksta koju model obrađuje odjednom.'],
  ['Sustavski prompt', 'Upute koje oblikuju ponašanje modela.'],
  ['Dohvaćanje znanja', 'Pretraga relevantnih dokumenata.'],
  ['Fino podešavanje uputa', 'Učenje modela da slijedi upute.'],
  ['Poravnanje (alignment)', 'Usklađivanje modela s namjerama.'],
  ['Ograde (guardrails)', 'Sigurnosna pravila za izlaz modela.'],
  ['Evaluacija agenata', 'Mjerenje uspješnosti izvođenja zadataka.'],
  ['Autonomni tijekovi rada', 'Lanci koraka bez ljudske intervencije.'],
  ['Generiranje sintetičkih podataka', 'Model stvara podatke za učenje.'],
  ['Destilacija i kompresija', 'Manji modeli iz velikih.'],
]

// Etika, sigurnost i poravnanje [naziv, opis]
const ETHICS = [
  ['Pristranost (bias)', 'Nepravedni obrasci naučeni iz podataka.'],
  ['Pravednost', 'Jednako postupanje prema skupinama.'],
  ['Transparentnost', 'Razumljivost rada modela.'],
  ['Objašnjivost (XAI)', 'Tumačenje odluka modela.'],
  ['Interpretabilnost', 'Razumijevanje unutarnjih mehanizama.'],
  ['Poravnanje (alignment)', 'Usklađivanje s ljudskim vrijednostima.'],
  ['Sigurnost AI-a', 'Sprječavanje štetnih ishoda.'],
  ['Rizik od AGI-a', 'Rizici napredne opće inteligencije.'],
  ['Halucinacije', 'Netočni, ali uvjerljivi izlazi.'],
  ['Privatnost podataka', 'Zaštita osobnih informacija.'],
  ['Deepfake', 'Lažni medijski sadržaj.'],
  ['Dezinformacije', 'Širenje neistinitog sadržaja.'],
  ['Utjecaj na radna mjesta', 'Automatizacija i promjene tržišta rada.'],
  ['Autorska prava', 'Pitanja vlasništva nad sadržajem.'],
  ['Otrovni sadržaj', 'Sprječavanje štetnih izlaza.'],
  ['Crvene ekipe (red teaming)', 'Namjerno testiranje slabosti.'],
  ['Regulativa (EU AI Act)', 'Zakonski okvir za umjetnu inteligenciju.'],
  ['Odgovorni AI', 'Etička načela u razvoju.'],
  ['Nadzor i upravljanje', 'Kontrola nad razvojem i upotrebom.'],
  ['Ekološki utjecaj', 'Potrošnja energije pri treniranju.'],
  ['Sigurnosno usklađivanje (RLHF)', 'Usklađivanje pomoću ljudskog povrata.'],
  ['Ljudski nadzor', 'Čovjek u petlji odlučivanja.'],
]

// Pioniri i istraživači [ime, godine, doprinos]
const PEOPLE = [
  ['Alan Turing', '1912–1954', 'Turingov test i temelji teorije računarstva.'],
  ['John McCarthy', '1927–2011', 'Skovao pojam "umjetna inteligencija", stvorio LISP.'],
  ['Marvin Minsky', '1927–2016', 'Suosnivač MIT-ovog laboratorija za AI.'],
  ['Claude Shannon', '1916–2001', 'Teorija informacije, temelj digitalne ere.'],
  ['Frank Rosenblatt', '1928–1971', 'Izumitelj perceptrona.'],
  ['Arthur Samuel', '1901–1990', 'Pionir strojnog učenja (igra dame).'],
  ['Joseph Weizenbaum', '1923–2008', 'Tvorac ELIZA-e, kritičar AI-a.'],
  ['Geoffrey Hinton', '1947–', '"Kum dubokog učenja", backpropagation i duboke mreže.'],
  ['Yann LeCun', '1960–', 'Pionir konvolucijskih mreža.'],
  ['Yoshua Bengio', '1964–', 'Duboko učenje i jezični modeli; Turingova nagrada 2018.'],
  ['Jürgen Schmidhuber', '1963–', 'Suautor LSTM-a, rani rad na dubokom učenju.'],
  ['Sepp Hochreiter', '1967–', 'Suautor LSTM arhitekture.'],
  ['Andrew Ng', '1976–', 'Online obrazovanje, Google Brain, Coursera.'],
  ['Fei-Fei Li', '1976–', 'Stvorila ImageNet, vodeća u računalnom vidu.'],
  ['Ian Goodfellow', '1985–', 'Izumitelj generativnih suparničkih mreža.'],
  ['Ilya Sutskever', '1986–', 'Suautor AlexNeta, suosnivač OpenAI-ja.'],
  ['Andrej Karpathy', '1986–', 'Duboko učenje, računalni vid, edukacija.'],
  ['Demis Hassabis', '1976–', 'Suosnivač DeepMinda, AlphaGo i AlphaFold.'],
  ['Richard Sutton', '1957–', 'Temelji potkrepljenog učenja.'],
  ['Judea Pearl', '1936–', 'Bayesove mreže i kauzalno zaključivanje.'],
  ['Stuart Russell', '1962–', 'Suautor temeljnog udžbenika AI-a.'],
  ['Peter Norvig', '1956–', 'Suautor udžbenika AI-a, Google.'],
  ['Ashish Vaswani', '—', 'Glavni autor rada o Transformeru.'],
  ['Alec Radford', '—', 'Rad na GPT i CLIP modelima.'],
  ['Jeff Dean', '1968–', 'Vodio Google Brain i AI infrastrukturu.'],
  ['Daphne Koller', '1968–', 'Grafički modeli, suosnivačica Coursere.'],
  ['Christopher Manning', '—', 'Vodeći u obradi prirodnog jezika.'],
  ['Pieter Abbeel', '—', 'Robotika i potkrepljeno učenje.'],
  ['Kunihiko Fukushima', '1936–', 'Neocognitron, preteča CNN-a.'],
  ['David Silver', '—', 'Vodeći istraživač AlphaGo programa.'],
]

// Tvrtke i laboratoriji [naziv, godina, opis]
const LABS = [
  ['OpenAI', '2015', 'GPT modeli, ChatGPT, DALL·E, Whisper.'],
  ['DeepMind', '2010', 'AlphaGo, AlphaFold, istraživanje opće inteligencije.'],
  ['Anthropic', '2021', 'Modeli Claude, istraživanje sigurne AI.'],
  ['Google Brain', '2011', 'TensorFlow, Transformer, BERT (danas dio Google DeepMinda).'],
  ['Meta AI (FAIR)', '2013', 'PyTorch, LLaMA, otvoreno istraživanje.'],
  ['Microsoft Research', '1991', 'Istraživanje AI-a i partnerstvo s OpenAI-jem.'],
  ['NVIDIA', '1993', 'GPU-i i CUDA, infrastruktura za AI.'],
  ['Hugging Face', '2016', 'Otvorena platforma modela i alata.'],
  ['Stability AI', '2020', 'Stable Diffusion i otvoreni generativni modeli.'],
  ['Cohere', '2019', 'Jezični modeli za poduzeća.'],
  ['Mistral AI', '2023', 'Učinkoviti otvoreni modeli iz Europe.'],
  ['IBM Research', '1945', 'Deep Blue, Watson, kvantni i AI projekti.'],
  ['Allen Institute (AI2)', '2014', 'Otvoreno istraživanje AI-a.'],
  ['Baidu Research', '2013', 'AI istraživanje i jezični modeli.'],
  ['Tesla AI', '2014', 'AI za autonomnu vožnju.'],
  ['xAI', '2023', 'Razvoj velikih jezičnih modela.'],
  ['Stanford AI Lab', '1962', 'Akademsko istraživanje AI-a.'],
  ['MIT CSAIL', '1959', 'Vodeći akademski laboratorij za AI.'],
  ['Montreal Institute (MILA)', '1993', 'Istraživanje dubokog učenja.'],
  ['EleutherAI', '2020', 'Otvoreni veliki jezični modeli.'],
]

// Pojmovnik AI-a [pojam, definicija]
const GLOSSARY = [
  ['Umjetna inteligencija', 'Sustavi koji obavljaju zadatke koji zahtijevaju ljudsku inteligenciju.'],
  ['Opća umjetna inteligencija (AGI)', 'Hipotetska AI s ljudskom svestranošću.'],
  ['Uska AI', 'AI specijalizirana za jedan zadatak.'],
  ['Model', 'Naučena funkcija koja preslikava ulaze u izlaze.'],
  ['Parametri', 'Naučene vrijednosti unutar modela.'],
  ['Težine', 'Parametri veza u neuronskoj mreži.'],
  ['Treniranje', 'Postupak učenja parametara iz podataka.'],
  ['Inferencija', 'Korištenje istreniranog modela na novim podacima.'],
  ['Skup podataka', 'Zbirka primjera za učenje i procjenu.'],
  ['Oznaka (label)', 'Točan izlaz pridružen primjeru.'],
  ['Predikcija', 'Izlaz modela za zadani ulaz.'],
  ['Neuronska mreža', 'Model inspiriran biološkim neuronima.'],
  ['Sloj', 'Skupina neurona u mreži.'],
  ['Tenzor', 'Višedimenzionalno polje brojeva.'],
  ['Gradijent', 'Smjer najbržeg rasta funkcije gubitka.'],
  ['Predtrenirani model', 'Model naučen na velikim općim podacima.'],
  ['Temeljni model', 'Veliki model prilagodljiv mnogim zadacima.'],
  ['Token', 'Osnovna jedinica teksta za jezične modele.'],
  ['Ugrađivanje', 'Vektorski prikaz značenja.'],
  ['Latentni prostor', 'Sažeti unutarnji prikaz podataka.'],
  ['Halucinacija', 'Uvjerljiv ali netočan izlaz modela.'],
  ['Prompt', 'Ulazna uputa jezičnom modelu.'],
  ['Temperatura', 'Parametar nasumičnosti pri generiranju.'],
  ['Zero-shot', 'Rješavanje zadatka bez primjera.'],
  ['Few-shot', 'Rješavanje zadatka uz nekoliko primjera.'],
  ['Generalizacija', 'Uspješnost modela na novim podacima.'],
  ['Pristranost (bias)', 'Sustavna pogreška ili nepravednost.'],
  ['Varijanca', 'Osjetljivost modela na podatke.'],
  ['Konvergencija', 'Stabilizacija učenja prema rješenju.'],
  ['Epoha', 'Jedan prolazak kroz podatke za treniranje.'],
  ['Serija (batch)', 'Skupina primjera u jednom koraku.'],
  ['Stopa učenja', 'Veličina koraka pri ažuriranju.'],
  ['Funkcija gubitka', 'Mjera pogreške modela.'],
  ['Aktivacija', 'Nelinearna transformacija izlaza neurona.'],
  ['Backbone', 'Temeljna mreža za izvlačenje značajki.'],
  ['Pipeline', 'Niz koraka obrade podataka i modela.'],
  ['Mjerilo (benchmark)', 'Standardizirani test za usporedbu modela.'],
  ['Skalirajući zakoni', 'Odnos veličine modela, podataka i učinka.'],
  ['Emergentne sposobnosti', 'Vještine koje se pojavljuju s veličinom modela.'],
  ['Multimodalnost', 'Rad s više vrsta podataka istovremeno.'],
]

// ── Builderi ───────────────────────────────────────────────────────────────
const eventNode = ([y, t, d]) =>
  N(`${y} — ${t}`, { cat: 'fact', summary: d, kind: 'event', children: [
    N(`Godina: ${y}`, { cat: 'fact' }),
    N(`Detalji: ${d}`, { cat: 'note', summary: d }),
  ] })

const pairNode = (prefix, cat, kind) => ([a, b]) =>
  N(`${prefix}${a}`, { cat, summary: b, kind, children: [ N(`Opis: ${b}`, { cat: 'note', summary: b }) ] })

const modelNode = ([name, year, maker, desc]) =>
  N(`Model: ${name}`, { cat: 'example', summary: `${name} (${year}, ${maker}) — ${desc}`, kind: 'tech', children: [
    N(`Godina: ${year}`, { cat: 'fact' }),
    N(`Tvorac: ${maker}`, { cat: 'example' }),
    N(`Vrsta: ${desc}`, { cat: 'definition' }),
    N(`Značaj: ${desc}`, { cat: 'note', summary: desc }),
  ] })

const algoNode = ([name, year, author, desc]) =>
  N(`Algoritam: ${name}`, { cat: 'process', summary: `${name} (${year}) — ${desc}`, kind: 'concept', children: [
    N(`Godina/izvor: ${year}`, { cat: 'fact' }),
    N(`Autor: ${author}`, { cat: 'example' }),
    N(`Opis: ${desc}`, { cat: 'note', summary: desc }),
  ] })

const personNode = ([name, years, contrib]) =>
  N(`Istraživač: ${name}`, { cat: 'example', summary: `${name} (${years}) — ${contrib}`, kind: 'person', children: [
    N(`Razdoblje: ${years}`, { cat: 'fact' }),
    N(`Doprinos: ${contrib}`, { cat: 'note', summary: contrib }),
  ] })

const labNode = ([name, year, desc]) =>
  N(`Laboratorij: ${name}`, { cat: 'note', summary: `${name} (${year}) — ${desc}`, kind: 'org', children: [
    N(`Osnovan/aktivan: ${year}`, { cat: 'fact' }),
    N(`Doprinos: ${desc}`, { cat: 'note', summary: desc }),
  ] })

// ── Grane ──────────────────────────────────────────────────────────────────
const BRANCHES = [
  N('Vremenska crta umjetne inteligencije', { cat: 'fact', summary: 'Ključne prekretnice u razvoju AI-a.', children: TIMELINE.map(eventNode) }),
  N('Područja umjetne inteligencije', { cat: 'concept', summary: 'Glavne grane i poddiscipline AI-a.', children: AREAS.map(pairNode('Područje: ', 'concept', 'concept')) }),
  N('Strojno učenje — koncepti', { cat: 'definition', summary: 'Temeljni pojmovi strojnog učenja.', children: MLCONCEPTS.map(pairNode('ML: ', 'definition', 'concept')) }),
  N('Algoritmi strojnog učenja', { cat: 'process', summary: 'Klasični algoritmi učenja iz podataka.', children: ALGOS.map(algoNode) }),
  N('Duboko učenje — koncepti', { cat: 'concept', summary: 'Pojmovi treniranja dubokih neuronskih mreža.', children: DLCONCEPTS.map(pairNode('DL: ', 'concept', 'concept')) }),
  N('Arhitekture neuronskih mreža', { cat: 'definition', summary: 'Vrste mreža i njihove strukture.', children: ARCH.map(pairNode('Arhitektura: ', 'definition', 'tech')) }),
  N('Modeli i sustavi', { cat: 'example', summary: 'Stvarni modeli koji su obilježili AI.', children: MODELS.map(modelNode) }),
  N('Obrada prirodnog jezika', { cat: 'concept', summary: 'Tehnologije razumijevanja i generiranja jezika.', children: NLP.map(pairNode('NLP: ', 'concept', 'concept')) }),
  N('Računalni vid', { cat: 'process', summary: 'Razumijevanje slika i videa.', children: VISION.map(pairNode('Vid: ', 'process', 'concept')) }),
  N('Potkrepljeno učenje', { cat: 'process', summary: 'Učenje kroz interakciju i nagrade.', children: RL.map(pairNode('RL: ', 'process', 'concept')) }),
  N('Generativni modeli', { cat: 'example', summary: 'Modeli koji stvaraju novi sadržaj.', children: GENERATIVE.map(pairNode('Gen: ', 'example', 'concept')) }),
  N('Matematički temelji', { cat: 'definition', summary: 'Matematika iza umjetne inteligencije.', children: MATH.map(pairNode('Matematika: ', 'definition', 'concept')) }),
  N('Evaluacija i metrike', { cat: 'question', summary: 'Mjerenje uspješnosti modela.', children: METRICS.map(pairNode('Metrika: ', 'question', 'concept')) }),
  N('Okviri i alati', { cat: 'note', summary: 'Knjižnice i alati za razvoj AI-a.', children: TOOLS.map(pairNode('Alat: ', 'note', 'tech')) }),
  N('Skupovi podataka i mjerila', { cat: 'fact', summary: 'Podaci i mjerila za treniranje i procjenu.', children: DATASETS.map(pairNode('Skup: ', 'fact', 'tech')) }),
  N('Hardver za AI', { cat: 'process', summary: 'Računalna infrastruktura za AI.', children: HARDWARE.map(pairNode('Hardver: ', 'process', 'tech')) }),
  N('Primjene umjetne inteligencije', { cat: 'example', summary: 'Gdje se AI koristi u stvarnom svijetu.', children: APPLICATIONS.map(pairNode('Primjena: ', 'example', 'concept')) }),
  N('Agentski sustavi i suvremeni AI', { cat: 'concept', summary: 'Agenti, alati i dohvaćanjem proširena generacija.', children: AGENTIC.map(pairNode('Agent: ', 'concept', 'concept')) }),
  N('Etika, sigurnost i poravnanje', { cat: 'question', summary: 'Odgovorni razvoj i rizici AI-a.', children: ETHICS.map(pairNode('Etika: ', 'question', 'concept')) }),
  N('Pioniri i istraživači', { cat: 'example', summary: 'Ljudi koji su oblikovali umjetnu inteligenciju.', children: PEOPLE.map(personNode) }),
  N('Tvrtke i laboratoriji', { cat: 'note', summary: 'Organizacije koje pokreću razvoj AI-a.', children: LABS.map(labNode) }),
  N('Pojmovnik umjetne inteligencije', { cat: 'definition', summary: 'Temeljni pojmovi AI-a.', children: GLOSSARY.map(pairNode('Pojam: ', 'definition', 'concept')) }),
]

const ROOT = N('Umjetna inteligencija — povijest, temelji i sadašnjost', {
  cat: 'root',
  summary: 'Interaktivna mapa znanja o umjetnoj inteligenciji i strojnom učenju, na hrvatskom jeziku.',
  children: BRANCHES,
})

// ───────────────────────────────────────────────────────────────────────────
//  PROŠIRENJE DO TOČNO TARGET ČVOROVA
// ───────────────────────────────────────────────────────────────────────────
function countNodes(node) {
  let c = 1
  if (node.children) for (const ch of node.children) c += countNodes(ch)
  return c
}

const ASPECTS = {
  tech: [
    ['Povijesni kontekst', 'nastao je kao odgovor na potrebe svoga vremena i razvijao se kroz niz inačica.'],
    ['Princip rada', 'počiva na jasnom tehničkom načelu.'],
    ['Arhitektura', 'ima prepoznatljivu unutarnju strukturu.'],
    ['Treniranje', 'uči se na velikim skupovima podataka.'],
    ['Podaci', 'ovisi o količini i kvaliteti podataka.'],
    ['Ključne značajke', 'donosi prepoznatljiv skup mogućnosti.'],
    ['Tipične primjene', 'koristi se u stvarnim sustavima i proizvodima.'],
    ['Performanse', 'pokazuje karakteristične profile brzine i točnosti.'],
    ['Prednosti', 'nudi konkretne prednosti koje su pridonijele usvajanju.'],
    ['Ograničenja', 'ima kompromise i scenarije gdje druga rješenja bolje odgovaraju.'],
    ['Utjecaj', 'ostavio je trag na kasnije modele i prakse.'],
    ['Suvremeni status', 'i danas ima jasnu ulogu u razvoju AI-a.'],
    ['Ekosustav', 'okružen je alatima, knjižnicama i zajednicom.'],
    ['Računalni zahtjevi', 'zahtijeva određene računalne resurse.'],
    ['Verzije i razvoj', 'kroz inačice donosi nove mogućnosti.'],
    ['Usporedba', 'mjeri se s konkurentskim pristupima.'],
    ['Sigurnosni aspekti', 'donosi specifične rizike koje treba poznavati.'],
    ['Pristranost i ograničenja', 'može naslijediti pristranosti iz podataka.'],
    ['Otvorenost', 'dostupan je u otvorenom ili zatvorenom obliku.'],
    ['Najbolje prakse', 'zajednica je iznjedrila preporučene obrasce upotrebe.'],
    ['Tipične zamke', 'postoje česte pogreške koje stručnjaci izbjegavaju.'],
    ['Budući smjer', 'razvoj se nastavlja u skladu s potrebama.'],
    ['Zanimljivost', 'uz njega se vežu zanimljive činjenice.'],
    ['Primjer iz prakse', 'najbolje se razumije kroz konkretan primjer.'],
    ['Povezani modeli', 'usko je povezan s drugim modelima i tehnikama.'],
    ['Sažetak', 'ključna poruka koju vrijedi zapamtiti.'],
  ],
  concept: [
    ['Definicija', 'precizno opisuje ideju i njezino mjesto u AI-u.'],
    ['Intuicija', 'lakše se razumije kroz jednostavnu analogiju.'],
    ['Motivacija', 'odgovara na konkretan problem u učenju iz podataka.'],
    ['Kako funkcionira', 'počiva na jasnom mehanizmu ili načelu.'],
    ['Matematika', 'iza ideje stoji prepoznatljiv matematički okvir.'],
    ['Primjer u praksi', 'najbolje se razumije kroz konkretan primjer.'],
    ['Prednosti', 'donosi mjerljive koristi kada se primjenjuje ispravno.'],
    ['Nedostaci', 'ima ograničenja koja treba uzeti u obzir.'],
    ['Zamke i greške', 'česte su pogreške koje treba izbjegavati.'],
    ['Povezani pojmovi', 'usko je povezan s drugim idejama i tehnikama.'],
    ['Povijest ideje', 'razvijao se kroz rad istraživača tijekom godina.'],
    ['Suvremena upotreba', 'aktualan je u modernim AI sustavima.'],
    ['Kada koristiti', 'postoje situacije u kojima je posebno prikladan.'],
    ['Kada izbjegavati', 'nije univerzalno rješenje i ima neprikladne kontekste.'],
    ['Složenost', 'nosi određenu cijenu u resursima ili razumijevanju.'],
    ['Mjerenje', 'uspjeh primjene može se pratiti odgovarajućim metrikama.'],
    ['Utjecaj na model', 'pravilna primjena poboljšava kvalitetu modela.'],
    ['Alternativni pristupi', 'postoje druge tehnike koje rješavaju sličan problem.'],
    ['Primjena u istraživanju', 'važan je u istraživanju i razvoju.'],
    ['Veza s drugim područjima', 'povezuje više disciplina umjetne inteligencije.'],
    ['Automatizacija', 'dijelovi se mogu automatizirati alatima.'],
    ['Najbolje prakse', 'postoje preporučeni obrasci za uspješnu primjenu.'],
    ['Edukacija', 'važan je dio obrazovanja u AI-u.'],
    ['Etika', 'otvara pitanja odgovornosti i pravednosti.'],
    ['Budućnost', 'i dalje se razvija s napretkom istraživanja.'],
    ['Sažetak', 'ključna poruka koju vrijedi zapamtiti.'],
  ],
  person: [
    ['Biografija', 'životni put oblikovao je doprinose umjetnoj inteligenciji.'],
    ['Obrazovanje', 'formalni put doveo je do područja rada.'],
    ['Ključni doprinos', 'rad je trajno utjecao na razvoj AI-a.'],
    ['Glavna djela', 'iza imena stoje prepoznatljivi radovi i ideje.'],
    ['Nagrade i priznanja', 'doprinosi su prepoznati u zajednici.'],
    ['Naslijeđe', 'ideje žive u modelima i alatima koje danas koristimo.'],
    ['Povezane osobe', 'surađivao/la je i utjecao/la na druge istraživače.'],
    ['Kontekst vremena', 'djelovao/la je u određenom razdoblju razvoja AI-a.'],
    ['Područja rada', 'bavio/la se prepoznatljivim područjima.'],
    ['Utjecaj na industriju', 'rad je promijenio praksu u industriji.'],
    ['Citati i misli', 'ostavio/la je zapažene misli o AI-u.'],
    ['Suradnje', 'surađivao/la je s institucijama i laboratorijima.'],
    ['Anegdote', 'uz ime se vežu poznate priče.'],
    ['Daljnje čitanje', 'o radu postoji opsežna literatura.'],
    ['Zanimljivost', 'uz njega/nju vežu se zanimljive činjenice.'],
    ['Sažetak doprinosa', 'ključna ostavština u jednoj rečenici.'],
  ],
  org: [
    ['Osnivanje', 'nastanak je vezan uz određeno vrijeme i viziju.'],
    ['Osnivači', 'iza nje stoje prepoznatljivi pojedinci.'],
    ['Ključni projekti', 'iza nje stoje modeli i sustavi s velikim utjecajem.'],
    ['Istraživački doprinos', 'pridonijela je temeljnim metodama AI-a.'],
    ['Utjecaj na industriju', 'oblikovala je smjer razvoja AI-a.'],
    ['Otvorenost', 'objavljuje istraživanja ili modele u različitom opsegu.'],
    ['Infrastruktura', 'raspolaže računalnim resursima za treniranje.'],
    ['Kultura i praksa', 'iznjedrila je prepoznatljive radne prakse.'],
    ['Kontroverze', 'kroz povijest je imala i sporne trenutke.'],
    ['Današnji status', 'i danas ima ulogu u razvoju AI-a.'],
    ['Partnerstva', 'rasla je kroz suradnje i ulaganja.'],
    ['Sigurnost i etika', 'bavi se i pitanjima sigurnosti AI-a.'],
    ['Globalni utjecaj', 'utječe na AI zajednicu diljem svijeta.'],
    ['Naslijeđe', 'ostavila je trajan trag u struci.'],
    ['Ljudi', 'okupljala je utjecajne istraživače.'],
    ['Sažetak', 'ključna uloga u jednoj rečenici.'],
  ],
  event: [
    ['Kontekst', 'dogodio se u određenom trenutku razvoja AI-a.'],
    ['Značaj', 'označava prekretnicu u području.'],
    ['Posljedice', 'utjecao je na sve što je uslijedilo.'],
    ['Sudionici', 'uz njega se vežu prepoznatljivi istraživači i timovi.'],
    ['Pozadina', 'prethodili su mu određeni uvjeti i otkrića.'],
    ['Reakcije', 'izazvao je odjek u struci i javnosti.'],
    ['Dugoročni utjecaj', 'njegove posljedice osjećaju se i danas.'],
    ['Povezani događaji', 'dio je šireg niza prekretnica.'],
    ['Pouke', 'iz njega struka izvlači trajne pouke.'],
    ['Zanimljivost', 'uz njega se vežu zanimljive činjenice.'],
    ['Sažetak', 'ključna poruka u jednoj rečenici.'],
  ],
}

const DETAILS = [
  ['Pojašnjenje', (e, a) => `Dodatno pojašnjenje teme „${a}” u kontekstu: ${e}.`],
  ['Primjer', (e, a) => `Ilustrativni primjer za „${a}” kod: ${e}.`],
  ['Napomena', (e, a) => `Praktična napomena vezana uz „${a}”: ${e}.`],
  ['Povezano', (e, a) => `Povezani aspekti teme „${a}” za: ${e}.`],
]

function entityName(label) {
  const idx = label.indexOf(': ')
  let s = idx >= 0 ? label.slice(idx + 2) : label
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
  const aspectNodes = []
  let round = 0, progressed = true
  while (total < TARGET && progressed) {
    progressed = false
    for (const node of entities) {
      if (total >= TARGET) break
      const pool = ASPECTS[node.kind]
      if (round >= pool.length) continue
      const [title, tail] = pool[round]
      const name = entityName(node.label)
      const aNode = N(`${title}: ${name}`, { cat: node.cat === 'root' ? 'note' : node.cat, summary: `${name} ${tail}`, _entity: name, _aspect: title })
      node.children.push(aNode)
      aspectNodes.push(aNode)
      total++; progressed = true
    }
    round++
  }
  let d = 0; progressed = true
  while (total < TARGET && progressed) {
    progressed = false
    for (const aNode of aspectNodes) {
      if (total >= TARGET) break
      if (d >= DETAILS.length) break
      const [title, fn] = DETAILS[d]
      if (!aNode.children) aNode.children = []
      aNode.children.push(N(`${title}: ${aNode._aspect}`, { cat: 'note', summary: fn(aNode._entity, aNode._aspect) }))
      total++; progressed = true
    }
    d++
  }
  return total
}
// Ako je TARGET manji od kurirane jezgre, ravnomjerno podreži najdublje listove
// (najprije "najdeblje" roditelje) dok ne dosegnemo točan broj. Time se čuva
// puna širina mape (sve grane i teme), a uklanjaju se samo detalji.
function trimToTarget(target) {
  ;(function assign(n, p) { n._parent = p; if (n.children) for (const c of n.children) assign(c, n) })(ROOT, null)
  let total = countNodes(ROOT)
  while (total > target) {
    let maxD = -1
    let leaves = []
    ;(function walk(n) {
      const isLeaf = !n.children || n.children.length === 0
      if (isLeaf && n._parent) {
        if (n._depth > maxD) { maxD = n._depth; leaves = [n] }
        else if (n._depth === maxD) leaves.push(n)
      }
      if (n.children) for (const c of n.children) walk(c)
    })(ROOT)
    if (!leaves.length) break
    const byParent = new Map()
    for (const lf of leaves) { const a = byParent.get(lf._parent) || []; a.push(lf); byParent.set(lf._parent, a) }
    const parents = Array.from(byParent.keys()).sort((a, b) => byParent.get(b).length - byParent.get(a).length)
    let removed = false
    for (const p of parents) {
      if (total <= target) break
      const lf = byParent.get(p).pop()
      if (!lf) continue
      const idx = p.children.indexOf(lf)
      if (idx >= 0) { p.children.splice(idx, 1); total--; removed = true }
    }
    if (!removed) break
  }
  return total
}

expandToTarget()
computeDepth(ROOT)              // potrebno za podrezivanje po dubini
const finalCount = trimToTarget(TARGET)
if (finalCount !== TARGET) console.warn(`⚠ Konačno ${finalCount} čvorova (cilj ${TARGET}).`)

// ── Raspored + stil + serijalizacija ────────────────────────────────────────
function computeLeaves(node) {
  if (!node.children || node.children.length === 0) { node._leaves = 1; return 1 }
  let s = 0
  for (const ch of node.children) s += computeLeaves(ch)
  node._leaves = s; return s
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
    let a = a0; const span = a1 - a0
    for (const ch of node.children) { layout(ch, a, a + span * (ch._leaves / node._leaves)); a += span * (ch._leaves / node._leaves) }
  }
}
layout(ROOT, 0, 2 * Math.PI)
function styleFor(node) {
  const d = node._depth, color = CAT[node.cat] || CAT.note
  if (d === 0) return { shape: 'pill', fillColor: '#04201E', borderColor: color, borderWidth: 3, textColor: '#FAFAFA', fontSize: 30, fontWeight: 800, shadowEnabled: true, glowEnabled: true }
  if (d === 1) return { shape: 'rounded', fillColor: '#141416', borderColor: color, borderWidth: 2.5, textColor: '#FAFAFA', fontSize: 20, fontWeight: 700, shadowEnabled: true, glowEnabled: false }
  if (d === 2) return { shape: 'rounded', fillColor: '#111113', borderColor: color, borderWidth: 1.75, textColor: '#FAFAFA', fontSize: 15, fontWeight: 600, shadowEnabled: true, glowEnabled: false }
  return { shape: 'rectangle', fillColor: '#0D0D0F', borderColor: '#27272A', borderWidth: 1, textColor: '#D4D4D8', fontSize: 12, fontWeight: 500, shadowEnabled: false, glowEnabled: false }
}
function sizeFor(node) {
  const d = node._depth, len = node.label.length
  const fs = d === 0 ? 30 : d === 1 ? 20 : d === 2 ? 15 : 12
  const w = Math.min(560, Math.max(d <= 1 ? 200 : 130, Math.round(len * fs * 0.62) + 36))
  const h = d === 0 ? 92 : d === 1 ? 60 : d === 2 ? 46 : 36
  return { width: w, height: h }
}
const baseTime = Date.now()
const nodes = [], edges = []
let nodeSeq = 0, edgeSeq = 0
function serialize(node, parentDbId) {
  const id = nid(), t = baseTime + nodeSeq
  nodeSeq++
  const dbNode = {
    id, type: 'text', position: { x: node._x, y: node._y }, size: sizeFor(node),
    content: node.label, style: styleFor(node), parentId: parentDbId, isRoot: node._depth === 0,
    metadata: { category: node.cat, ai: { generatedBy: 'generate', inferredCategory: node.cat }, ...(node.summary ? { description: { summary: node.summary, generatedAt: t } } : {}) },
    createdAt: t, updatedAt: t,
  }
  if (!parentDbId) delete dbNode.parentId
  nodes.push(dbNode)
  if (parentDbId) {
    const d = node._depth
    edges.push({ id: 'e' + (edgeSeq++).toString(36), sourceId: parentDbId, targetId: id,
      style: { type: 'bezier', strokeColor: d <= 1 ? (CAT[node.cat] || '#3A3A40') : '#26262B', strokeWidth: Math.max(0.6, 2.6 - d * 0.6), arrowStart: 'none', arrowEnd: 'none', animated: false },
      createdAt: t, updatedAt: t })
  }
  if (node.children) for (const ch of node.children) serialize(ch, id)
  return id
}
const rootId = serialize(ROOT, null)

const doc = {
  id: `umjetna-inteligencija-${SIZE_LABEL}-` + baseTime.toString(36),
  title: `Umjetna inteligencija — povijest, temelji i sadašnjost (${SIZE_LABEL})`,
  nodes, edges,
  camera: { x: 0, y: 0, zoom: 0.032 },
  rootNodeId: rootId,
  settings: {
    gridEnabled: true, gridSize: 32, snapToGrid: false, backgroundColor: '#0D0D0F',
    defaultNodeStyle: { shape: 'rounded', fillColor: '#111113', borderColor: '#27272A', borderWidth: 1.5, textColor: '#FAFAFA', fontSize: 14, fontWeight: 500, shadowEnabled: true, glowEnabled: false },
    defaultEdgeStyle: { type: 'bezier', strokeColor: '#2A2A30', strokeWidth: 2, arrowStart: 'none', arrowEnd: 'arrow', animated: false },
  },
  createdAt: baseTime, updatedAt: baseTime,
  tags: ['umjetna-inteligencija', 'strojno-učenje', 'AI', 'hrvatski', '20k'],
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
