// Spiele für den Spiele-Schalter (nur der Admin wählt, gilt ab dem nächsten Run).
// Pro Spiel: Name, Region, Generation, höchste Dex-Nummer (Suche), Bonus-Bereich der Suche,
// Standard-Routen und Level-Caps. Schwarz/Weiß ist der Standard und behält seine alten Routen-IDs.
// Routen und Level sind ein Vorschlag (Reihenfolge wie beim Durchspielen, Level = stärkstes Pokémon),
// auf der Seite lässt sich alles ändern. Arenaleiter-Namen nach PokéWiki.
//
// Routen: Text = Route mit automatischer ID (r01, r02, …) in dieser Reihenfolge.
//         "+Name|Hinweis" = Extra-Encounter (zählt nicht für „gewonnen“), Hinweis steht an der Route.
//         [id, order, name, extra] = feste ID (nur Schwarz/Weiß, wegen alter Daten).
// Caps:   [id, Name, Ort, Level, Arena?]. IDs g1 … g8, e4, ch, x1 über alle Spiele gleich halten,
//         die Firestore-Regeln erlauben höchstens 20 verschiedene.
(function(){
"use strict";
var FOSSIL="Zählt nur, wenn alle ein Fossil finden.";
function kantoCaps(e4,ch,lv){return [
  ["g1","Rocko","Marmoria City",lv[0],1],["g2","Misty","Azuria City",lv[1],1],["g3","Major Bob","Orania City",lv[2],1],
  ["g4","Erika","Prismania City",lv[3],1],["g5","Koga","Fuchsania City",lv[4],1],["g6","Sabrina","Saffronia City",lv[5],1],
  ["g7","Pyro","Zinnoberinsel",lv[6],1],["g8","Giovanni","Vertania City",lv[7],1],
  ["e4","Top Vier","Indigo-Plateau",e4],["ch",ch,"Indigo-Plateau",lv[8]]]}
function johtoCaps(lv){return [
  ["g1","Falk","Viola City",lv[0],1],["g2","Kai","Azalea City",lv[1],1],["g3","Bianka","Dukatia City",lv[2],1],
  ["g4","Jens","Teak City",lv[3],1],["g5","Hartwig","Anemonia City",lv[4],1],["g6","Jasmin","Oliviana City",lv[5],1],
  ["g7","Norbert","Mahagonia City",lv[6],1],["g8","Sandra","Ebenholz City",lv[7],1],
  ["e4","Top Vier","Indigo-Plateau",lv[8]],["ch","Siegfried","Indigo-Plateau",lv[9]],["x1","Rot (optional)","Silberberg",lv[10]]]}
function hoennCaps(g8,ch,lv){return [
  ["g1","Felizia","Metarost City",lv[0],1],["g2","Kamillo","Faustauhaven",lv[1],1],["g3","Walter","Malvenfroh City",lv[2],1],
  ["g4","Flavia","Bad Lavastadt",lv[3],1],["g5","Norman","Blütenburg City",lv[4],1],["g6","Wibke","Baumhausen City",lv[5],1],
  ["g7","Ben & Svenja","Moosbach City",lv[6],1],["g8",g8,"Xeneroville",lv[7],1],
  ["e4","Top Vier","Prachtpolis City",lv[8]],["ch",ch,"Prachtpolis City",lv[9]]]}
function sinnohCaps(order,lv){var L={veit:["Veit","Erzelingen"],silvana:["Silvana","Ewigenau"],hilda:["Hilda","Schleiede"],marinus:["Marinus","Weideburg"],
  lamina:["Lamina","Herzhofen"],adam:["Adam","Fleetburg"],frida:["Frida","Blizzach"],volkner:["Volkner","Sonnewik"]};
  var out=order.map(function(k,i){return ["g"+(i+1),L[k][0],L[k][1],lv[i],1]});
  out.push(["e4","Top Vier","Pokémon-Liga",lv[8]],["ch","Cynthia","Pokémon-Liga",lv[9]]);return out}

var KANTO=["Starter (Alabastia)","Route 1","Route 22","Route 2","Vertania-Wald","Route 3","Mondberg","+Fossil (Extra-Encounter)|"+FOSSIL+" Helix- oder Domfossil aus dem Mondberg, wiederbelebt auf der Zinnoberinsel.",
  "Route 4","Route 24","Route 25","Route 5","Route 6","Route 11","Digda-Höhle","Route 9","Route 10","Felstunnel","Route 8","Route 7",
  "Prismania City (Evoli, Geschenk)","Pokémon-Turm","Route 12","Route 13","Route 14","Route 15","Route 16","Route 17","Route 18","Safari-Zone",
  "Saffronia City (Kampfdojo, Geschenk)","Silph Co. (Lapras, Geschenk)","Route 19","Route 20","Seeschauminseln","Zinnoberinsel","Pokémon-Villa","Route 21","Kraftwerk","Route 23","Siegesstraße"];
var JOHTO=["Starter (Neuborkia)","Route 29","Route 46","Route 30","Route 31","Dunkelhöhle","Knofensa-Turm","Togepi-Ei (Viola City, Geschenk)","Route 32","Alph-Ruinen","Einheitstunnel","Route 33",
  "Flegmon-Brunnen","Steineichenwald","Route 34","Dukatia City (Geschenk)","Route 35","Nationalpark","Route 36","Route 37","Turmruine","Route 38","Route 39","Oliviana City (Geschenk)",
  "Route 40","Route 41","Anemonia City (Geschenk)","Route 42","Kesselberg","Mahagonia City","Route 43","See des Zorns","Route 44","Eispfad","Route 45","Drachenhöhle","Route 27","Tohjo-Fälle","Route 26","Siegesstraße"];
var HOENN=["Starter (Route 101)","Route 101","Route 103","Route 102","Route 104","Blütenburgwald","Route 116","Metaflurtunnel","Granithöhle","Route 105","Route 106","Route 107","Route 109","Route 110",
  "Route 117","Route 111","Route 112","Feuriger Pfad","Route 113","Route 114","Meteorfälle","Route 115","Steilpass","Bad Lavastadt (Ei, Geschenk)",
  "+Fossil (Extra-Encounter)|"+FOSSIL+" Wurzel- oder Klauenfossil aus der Wüste (Route 111), wiederbelebt in Metarost City.",
  "Route 118","Route 119","Wetterinstitut (Formeo, Geschenk)","Route 120","Route 121","Safari-Zone","Route 122","Pyroberg","Route 123","Neu Malvenfroh",
  "Route 124","Route 125","Küstenhöhle","Route 126","Route 127","Route 128","Tiefseehöhle","Route 129","Route 130","Route 131","Route 132","Route 133","Route 134","Himmelturm","Siegesstraße"];
var SINNOH=["Starter (Route 201)","Route 201","Route 202","Route 203","Erzelingen-Tor","Erzelingen-Mine","Route 204","Route 205","Ewigwald","Windkraftwerk","Route 211","Kraterberg",
  "Route 206","Route 207","Route 208","Route 209","Turm der Ruhenden","Trostu-Ruinen","Route 210","Route 215","Route 214","Scheidequelle","Route 213","Route 212","Pokémon-Landgut",
  "Großmoor","Eiseninsel (Riolu-Ei, Geschenk)","Route 218","Route 216","Route 217","See der Kühnheit","Route 219","Route 220","Route 221","Route 222","Speersäule","Route 223","Siegesstraße",
  "+Fossil (Extra-Encounter)|"+FOSSIL+" Schädel- oder Panzerfossil aus dem Untergrund, wiederbelebt im Museum von Erzelingen."];
var ALOLA=["Starter (Lili’i)","Route 1","Route 2","Hauholi-Friedhof","Tenkarat-Hügel","Vegetationshöhle","Route 3","Mele-Mele-Blumenmeer","Kala’e-Bucht","Meereshöhle","Ruinen des Krieges",
  "Route 4","Route 5","Plätscherhügel","Route 6","Route 7","Wela-Vulkanpark","Route 8","Schattendschungel","Ohana-Farm","Hügel des Gedenkens","Akala-Küstenstreifen","Digda-Tunnel","Route 9","Ruinen des Lebens",
  "+Fossil (Extra-Encounter)|"+FOSSIL+" Fossilien aus Konikoni City, wiederbelebt auf Route 8.",
  "Route 10","Hokulani-Berg","Route 11","Route 12","Route 13","Haina-Wüste","Route 14","Route 15 (Wasserweg)","Route 16","Ula-Ula-Blumenmeer","Route 17","Dorf der Kapu","Malihe-Ziergarten","Ruinen des Gedeihens",
  "Wildnis von Poni","Alter Pfad von Poni","Ruinen der Heimkehr","Poni-Blumenmeer","Canyon von Poni","Mount Lanakila"];

var G=[
 {id:"rb",name:"Rot & Blau",region:"Kanto",gen:1,maxDex:151,boost:[1,151],routes:KANTO,caps:kantoCaps(62,"Champ (Rivale)",[14,21,24,29,43,43,47,50,65])},
 {id:"yellow",name:"Gelb",region:"Kanto",gen:1,maxDex:151,boost:[1,151],routes:["Starter Pikachu (Alabastia)"].concat(KANTO.slice(1)),caps:kantoCaps(62,"Champ (Rivale)",[12,21,28,32,50,50,54,55,65])},
 {id:"gsc",name:"Gold, Silber & Kristall",region:"Johto",gen:2,maxDex:251,boost:[152,251],routes:JOHTO,caps:johtoCaps([9,16,20,25,30,35,31,40,47,50,81])},
 {id:"rs",name:"Rubin & Saphir",region:"Hoenn",gen:3,maxDex:386,boost:[252,386],routes:HOENN,caps:hoennCaps("Wassili","Troy",[15,18,23,28,31,33,42,43,53,58])},
 {id:"emerald",name:"Smaragd",region:"Hoenn",gen:3,maxDex:386,boost:[252,386],routes:HOENN,caps:hoennCaps("Juan","Wassili",[15,19,24,29,31,33,42,46,55,58])},
 {id:"frlg",name:"Feuerrot & Blattgrün",region:"Kanto",gen:3,maxDex:386,boost:[1,151],
  routes:KANTO.slice(0,KANTO.indexOf("Route 21")+1).concat(["Schatzgestade","Glutberg","Kap Kante","Bundbrücke","Beerenforst"]).concat(KANTO.slice(KANTO.indexOf("Route 21")+1)),
  caps:kantoCaps(60,"Champ (Rivale)",[14,21,24,29,43,43,47,50,63])},
 {id:"dp",name:"Diamant & Perl",region:"Sinnoh",gen:4,maxDex:493,boost:[387,493],routes:SINNOH,
  caps:sinnohCaps(["veit","silvana","hilda","marinus","lamina","adam","frida","volkner"],[14,22,30,30,36,41,42,49,63,66])},
 {id:"pt",name:"Platin",region:"Sinnoh",gen:4,maxDex:493,boost:[387,493],routes:SINNOH,
  caps:sinnohCaps(["veit","silvana","lamina","hilda","marinus","adam","frida","volkner"],[14,22,26,32,37,41,44,50,59,62])},
 {id:"hgss",name:"HeartGold & SoulSilver",region:"Johto",gen:4,maxDex:493,boost:[152,251],
  routes:JOHTO.slice(0,JOHTO.indexOf("Route 42")).concat(["Route 47","Route 48","Safari-Zone (Johto)"]).concat(JOHTO.slice(JOHTO.indexOf("Route 42"))),
  caps:johtoCaps([13,17,19,25,31,35,34,41,47,50,88])},
 {id:"bw",name:"Schwarz & Weiß",region:"Einall",gen:5,maxDex:649,boost:[494,649],
  routes:[["r01",1,"Starter (Avenitia)"],["r02",2,"Route 1"],["r03",3,"Route 2"],["r04",4,"Orion City (Geschenk)"],["r05",5,"Traumbrache"],["r06",6,"Route 3"],["r07",7,"Grundwassersenke"],["r08",8,"Ewigenwald"],["r09",9,"Stratos City"],["r10",10,"Route 4"],["r11",11,"Wüstenresort"],["r42",11.2,"Alter Palast"],["r43",11.4,"+Fossil (Extra-Encounter)|"+FOSSIL+" Schild- oder Federfossil, wiederbelebt im Museum von Septerna City."],["r13",13,"Route 16"],["r14",14,"Hain der Täuschung"],["r15",15,"Route 5"],["r16",16,"Marea City"],["r17",17,"Route 6"],["r18",18,"Elektrolithhöhle"],["r19",19,"Panaero-Höhle"],["r20",20,"Route 7"],["r21",21,"Turm des Himmels"],["r22",22,"Wendelberg"],["r23",23,"Route 8"],["r24",24,"Moor von Nevaio"],["r25",25,"Drachenstiege"],["r26",26,"Route 9"],["r27",27,"Route 10"],["r28",28,"Siegesstraße"],["r29",29,"Route 11"],["r30",30,"Route 12"],["r31",31,"Dorfbrücke"],["r32",32,"Route 13"],["r33",33,"Ondula"],["r34",34,"Bucht von Ondula"],["r35",35,"Route 14"],["r36",36,"Schrein der Ernte"],["r37",37,"Route 15"],["r38",38,"Route 17"],["r39",39,"Route 18"],["r40",40,"Riesengrotte"],["r41",41,"Höhle der Prüfung"]],
  caps:[["g1","Benny / Maik / Colin","Orion City",14,1],["g2","Aloe","Septerna City",20,1],["g3","Artie","Stratos City",23,1],["g4","Kamilla","Rayono City",27,1],
   ["g5","Turner","Marea City",31,1],["g6","Géraldine","Panaero City",35,1],["g7","Sandro","Nevaio City",39,1],["g8","Lysander / Lilia","Twindrake City",43,1],
   ["e4","Top Vier","Pokémon-Liga",50],["n","N","Schloss von N",52],["gc","G-Cis","Schloss von N",54]]},
 {id:"b2w2",name:"Schwarz 2 & Weiß 2",region:"Einall",gen:5,maxDex:649,boost:[494,649],
  routes:["Starter (Eventura City)","Route 19","Route 20","Dausing-Hof","Vapydro-Werke","Stratos City (Evoli, Geschenk)","Route 4","Wüstenresort","Alter Palast",
   "+Fossil (Extra-Encounter)|"+FOSSIL+" Fossil aus dem Wüstenresort, wiederbelebt im Museum von Septerna City.",
   "Route 16","Hain der Täuschung","Route 5","Marea-Zugbrücke","Alter Fluchtweg","Route 6","Elektrolithhöhle","Route 7","Turm des Himmels","Janusberg","Ondula",
   "Route 13","Strandgrotte","Route 12","Dorfbrücke","Route 11","Route 9","Route 21","Route 22","Riesengrotte","Route 23","Siegesstraße"],
  caps:[["g1","Cheren","Eventura City",13,1],["g2","Mica","Vapydro City",18,1],["g3","Artie","Stratos City",24,1],["g4","Kamilla","Rayono City",30,1],
   ["g5","Turner","Marea City",33,1],["g6","Géraldine","Panaero City",39,1],["g7","Lysander","Twindrake City",48,1],["g8","Benson","Abidaya City",51,1],
   ["e4","Top Vier","Pokémon-Liga",58],["ch","Lilia","Pokémon-Liga",59]]},
 {id:"xy",name:"X & Y",region:"Kalos",gen:6,maxDex:721,boost:[650,721],
  routes:["Starter (Aquarellia)","Route 2","Nouvaria-Wald","Route 22","Route 3","Route 4","Illumina City (Kanto-Starter, Geschenk)","Route 5","Route 6","Route 7","Route 8",
   "+Fossil (Extra-Encounter)|"+FOSSIL+" Kiefer- oder Flossenfossil aus der Leuchthöhle, wiederbelebt in Petrophia.",
   "Leuchthöhle","Route 9","Route 10","Route 11","Spiegelhöhle","Turm der Erkenntnis (Lucario, Geschenk)","Route 12","Azurbucht","Route 13","Route 14","Route 15","Route 16",
   "Hotelruine","Frosthöhle","Route 17","Route 18","Route 19","Route 20","Pokémon-Dorf","Route 21","Siegesstraße"],
  caps:[["g1","Viola","Nouvaria City",12,1],["g2","Lino","Relievera City",25,1],["g3","Connie","Yantara City",32,1],["g4","Amaro","Tempera City",34,1],
   ["g5","Citro","Illumina City",37,1],["g6","Valerie","Romantia City",42,1],["g7","Astrid","Fluxia City",48,1],["g8","Galantho","Fractalia City",59,1],
   ["e4","Top Vier","Pokémon-Liga",65],["ch","Diantha","Pokémon-Liga",68]]},
 {id:"oras",name:"Omega Rubin & Alpha Saphir",region:"Hoenn",gen:6,maxDex:721,boost:[252,386],routes:HOENN,caps:hoennCaps("Wassili","Troy",[14,16,21,28,30,35,45,46,55,59])},
 {id:"sm",name:"Sonne & Mond",region:"Alola",gen:7,maxDex:802,boost:[722,802],routes:ALOLA,
  caps:[["t1","Prüfung Elima (Totem)","Mele-Mele",12],["g1","Hala","Mele-Mele",15,1],["t2","Prüfung Tracy (Totem)","Akala",20],["t3","Prüfung Kiawe (Totem)","Akala",22],
   ["t4","Prüfung Maho (Totem)","Akala",24],["g2","Mayla","Akala",27,1],["t5","Prüfung Chrys (Totem)","Ula-Ula",29],["t6","Prüfung Lola (Totem)","Ula-Ula",33],
   ["g3","Nanu","Ula-Ula",39,1],["t7","Totem im Poni-Canyon","Poni",45],["g4","Hapu","Poni",48,1],["e4","Top Vier","Pokémon-Liga",55],["ch","Prof. Kukui","Pokémon-Liga",58]]},
 {id:"usum",name:"Ultrasonne & Ultramond",region:"Alola",gen:7,maxDex:807,boost:[722,807],routes:ALOLA,
  caps:[["t1","Prüfung Elima (Totem)","Mele-Mele",12],["g1","Hala","Mele-Mele",16,1],["t2","Prüfung Tracy (Totem)","Akala",20],["t3","Prüfung Kiawe (Totem)","Akala",22],
   ["t4","Prüfung Maho (Totem)","Akala",24],["g2","Mayla","Akala",28,1],["t5","Prüfung Chrys (Totem)","Ula-Ula",33],["t6","Prüfung Lola (Totem)","Ula-Ula",35],
   ["g3","Nanu","Ula-Ula",44,1],["t7","Totem im Poni-Canyon","Poni",49],["g4","Hapu","Poni",54,1],["t8","Prüfung Mina (Totem)","Poni",55],
   ["e4","Top Vier","Pokémon-Liga",57],["ch","Tali","Pokémon-Liga",60]]},
 {id:"lgpe",name:"Let’s Go, Pikachu! & Let’s Go, Evoli!",title:"Let’s Go Pikachu & Evoli",region:"Kanto",gen:7,maxDex:151,extraDex:[808,809],boost:[1,151],
  routes:KANTO.filter(function(r){return r!=="Prismania City (Evoli, Geschenk)"&&r!=="Safari-Zone"}),
  caps:kantoCaps(55,"Trace",[12,19,26,34,44,44,48,50,57])},
 {id:"swsh",name:"Schwert & Schild",region:"Galar",gen:8,maxDex:898,boost:[810,898],
  routes:["Starter (Furlongham)","Route 1","Route 2","Naturzone: Wonnewiesen","Naturzone: Milza-See (Osten)","Naturzone: Brückental","Naturzone: Sitz des Giganten","Route 3","Galar-Mine","Route 4","Route 5",
   "Galar-Mine 2","Naturzone: Spiegel des Giganten","Naturzone: Wutanfall-See","Naturzone: Hut des Giganten","Route 6",
   "+Fossil (Extra-Encounter)|"+FOSSIL+" Zwei Fossilhälften von Route 6 oder aus der Naturzone, zusammengesetzt auf Route 6.",
   "Wirrschein-Wald","Route 7","Route 8","Route 9","Claw-Plateau","Route 10"],
  caps:[["g1","Yarro","Turffield",20,1],["g2","Kate","Keelton",24,1],["g3","Kabu","Engine City",27,1],["g4","Saida / Nio","Passbeck",36,1],
   ["g5","Papella","Fairballey",38,1],["g6","Mac / Mel","Circhester",42,1],["g7","Nezz","Spikeford",46,1],["g8","Roy","Claw City",48,1],
   ["cc","Champ-Cup (Finale)","Score City",55],["ch","Delion","Score City",65]]},
 {id:"bdsp",name:"Strahlender Diamant & Leuchtende Perle",title:"Strahlender Diamant & Leuchtende Perle",region:"Sinnoh",gen:8,maxDex:493,boost:[387,493],routes:SINNOH,
  caps:sinnohCaps(["veit","silvana","hilda","marinus","lamina","adam","frida","volkner"],[14,22,30,30,36,39,42,49,63,66])},
 {id:"sv",name:"Karmesin & Purpur",region:"Paldea",gen:9,maxDex:1025,boost:[906,1025],
  routes:["Starter (Pratolido)","Cucharico-Pfad","Meeresbuchthöhle","Südliche Zone 1","Südliche Zone 2","Südliche Zone 4","Südliche Zone 3","Südliche Zone 5","Östliche Zone 3",
   "Östliche Zone 2","Östliche Zone 1","Westliche Zone 1","Brutzelwüste","Westliche Zone 2","Westliche Zone 3","Asarilla-Grotte","Südliche Zone 6","Nördliche Zone 1",
   "Caldero-See","Montanata","Mesclores-Passage","Nördliche Zone 2","Nördliche Zone 3","Knusperwaldweg","Schmierhain","Zone Null"],
  caps:[["g1","Ronah","Moldrid",15,1],["g2","Colzo","Bolardin",17,1],["g3","Enigmara","Fermanca City",24,1],["g4","Kombu","Garrafosa City",30,1],
   ["g5","Aoki","Mesclarra",36,1],["g6","Etta","Frigomonta",42,1],["g7","Tulia","Asarilla",45,1],["g8","Grusha","Montanata",48,1],
   ["e4","Top Vier","Pokémon-Liga",61],["ch","Sagaria","Pokémon-Liga",62]]}
];

// Routen und Caps in die Form bringen, die js/app.js erwartet.
var BY={};
G.forEach(function(g){
  g.routes=g.routes.map(function(r,i){
    var id,order,name;
    if(Array.isArray(r)){id=r[0];order=r[1];name=r[2]}else{id="r"+String(i+1).padStart(2,"0");order=i+1;name=r}
    var o={id:id,order:order,name:name};
    if(name.charAt(0)==="+"){var p=name.slice(1).split("|");o.name=p[0];o.extra=true;o.hint=p[1]||""}
    return o});
  g.caps=g.caps.map(function(c){return {id:c[0],name:c[1],place:c[2],lv:c[3],gym:!!c[4]}});
  g.title=g.title||g.name;
  BY[g.id]=g});
window.SOULLINK_GAMES={list:G,byId:BY,def:"bw"};
})();
