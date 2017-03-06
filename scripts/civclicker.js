"use strict";
/*jslint browser: true, devel: true, passfail: false, continue: true, eqeq: true, plusplus: true, vars: true, white: true, indent: 4, maxerr: 999 */
/* jshint laxbreak: true, laxcomma: true */
/* global updateJobButtons,updatePurchaseRow,updateResourceTotals,updateBuildingTotals,updateMobs,updateDeity,updateUpgrades,updateOldDeities,updateDevotion,updateParty,updateMorale,updateWonder,updatePopulation,calcCost,updateJobs,updateAchievements,updateTargets,updateWonderList,digGraves,renameDeity,spawnMob,renameWonder,adjustMorale,versionAlert,gameLog,prettify,LZString,bake_cookie,read_cookie,prettify,updateRequirements,calcWorkerCost,mergeObj,isValid,setElemDisplay,rndRound,playerCombatMods,dataset,copyProps,updatePopulationUI,calcZombieCost,logSearchFn,getCustomNumber,calcArithSum,SecurityError,doSlaughter,doLoot,doHavoc,valOf,setAutosave,setCustomQuantities,textSize,setDelimiters,setShadow,setNotes,setWorksafe,setIcons,deleteCookie,matchType,addPUpgradeRows */
/**
    CivClicker
    Copyright (C) 2014; see the AUTHORS file for authorship.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program in the LICENSE file.
    If it is not there, see <http://www.gnu.org/licenses/>.
**/


var version = 19; // This is an ordinal used to trigger reloads.
function VersionData(major,minor,sub,mod) {
    this.major = major;
    this.minor = minor;
    this.sub = sub;
    this.mod = mod;
}
VersionData.prototype.toNumber = function() { return this.major*1000 + this.minor + this.sub/1000; };
VersionData.prototype.toString = function() { return String(this.major) + "." 
    + String(this.minor) + "." + String(this.sub) + String(this.mod); };

var versionData = new VersionData(1,1,59,"alpha");

var saveTag = "civ";
var saveTag2 = saveTag + "2"; // For old saves.
var saveSettingsTag = "civSettings";
var logRepeat = 1;


// Civ size category minimums
var civSizes = [
{ min_pop :      0, name : "Thorp"       , id : "thorp"      },
{ min_pop :     20, name : "Hamlet"      , id : "hamlet"     },
{ min_pop :     60, name : "Village"     , id : "village"    },
{ min_pop :    200, name : "Small Town"  , id : "smallTown"  },
//xxx This is a really big jump.  Reduce it.
{ min_pop :   2000, name : "Large Town"  , id : "largeTown"  },
{ min_pop :   5000, name : "Small City"  , id : "smallCity"  },
{ min_pop :  10000, name : "Large City"  , id : "largeCity"  },
{ min_pop :  20000, name:"Metro&shy;polis",id : "metropolis" },
{ min_pop :  50000, name : "Small Nation", id : "smallNation"},
{ min_pop : 100000, name : "Nation"      , id : "nation"     },
{ min_pop : 200000, name : "Large Nation", id : "largeNation"},
{ min_pop : 500000, name : "Empire"      , id : "empire"     }];
indexArrayByAttr(civSizes, "id");

// Annotate with max population and index.
civSizes.forEach(function(elem,i,arr) {
    elem.max_pop = (i+1 < arr.length) ? (arr[i+1].min_pop - 1) : Infinity;
    elem.idx = i;
});

civSizes.getCivSize = function(popcnt) {
    var i;
    for(i = 0; i< this.length; ++i){
        if (popcnt <= this[i].max_pop) { return this[i]; }
    }
    return this[0];
};


// Declare variables here so they can be referenced later.  
var curCiv = {
    civName : "Woodstock",
    rulerName : "Orteil",

    zombie: { owned:0 },
    grave: { owned:0 },
    enemySlain: { owned:0 },
    morale : { mod:1.0 },

    resourceClicks : 0, // For NeverClick
    attackCounter : 0, // How long since last attack?

    trader : {
        materialId:"",
        requested:0,
        timer:0,
        counter : 0 // How long since last trader?
    },

    raid: {
        raiding:false, // Are we in a raid right now?
        victory:false, // Are we in a "raid succeeded" (Plunder-enabled) state right now?
        epop:0,  // Population of enemy we're raiding.
        plunderLoot: {}, // Loot we get if we win.
        last:"",
        targetMax : civSizes[0].id // Largest target allowed
    },

    curWonder : {
        name:"",
        stage:0, // 0 = Not started, 1 = Building, 2 = Built, awaiting selection, 3 = Finished.
        progress:0, // Percentage completed.
        rushed:false
    },
    wonders:[],  // Array of {name: name, resourceId: resourceId} for all wonders.

    // Known deities.  The 0th element is the current game's deity.
    // If the name is "", no deity has been created (can also check for worship upgrade)
    // If the name is populated but the domain is not, the domain has not been selected.
    deities : [ { name:"", domain:"", maxDev:0 } ]  // array of { name, domain, maxDev }

    //xxx We're still accessing many of the properties put here by civData
    //elements without going through the civData accessors.  That should
    //change.
};


function getCurDeityDomain() { return (curCiv.deities.length > 0) ? curCiv.deities[0].domain : undefined; }

// These are not saved, but we need them up here for the asset data to init properly.
var population = {
    current:0,
    limit:0,
    healthy:0,
    totalSick:0
};

// Caches the total number of each wonder, so that we don't have to recount repeatedly.
var wonderCount = {};

// Tallies the number of each wonder from the wonders array.
function updateWonderCount() {
    wonderCount = {};
    curCiv.wonders.forEach(function(elem) {
        var resourceId = elem.resourceId;
        if (!isValid(wonderCount[resourceId])) { wonderCount[resourceId] = 0; }
        ++wonderCount[resourceId];
    });
}

// Return the production multiplier from wonders for a resource.
function getWonderBonus(resourceObj)
{
    if (!resourceObj) { return 1; }
    return (1 + (wonderCount[resourceObj.id]||0)/10);
}

var civData; //xxx Should this be deleted?

//xxxTODO: Create a mechanism to automate the creation of a class hierarchy,
// specifying base class, shared props, instance props.
function CivObj(props, asProto)
{
    if (!(this instanceof CivObj)) { return new CivObj(props); } // Prevent accidental namespace pollution
    //xxx Should these just be taken off the prototype's property names?
    var names = asProto ? null : ["id","name","subType","owned","prereqs","require","salable","vulnerable","effectText"
                                 ,"prestige","initOwned","init","reset","limit","hasVariableCost"];
    Object.call(this,props);
    copyProps(this,props,names,true);
    return this;
}

// Common Properties: id, name, owned, prereqs, require, effectText,
//xxx TODO: Add save/load methods.
CivObj.prototype = {
    constructor: CivObj,
    subType: "normal",
    get data() { return curCiv[this.id]; },
    set data(value) { curCiv[this.id] = value; },
    get owned() { return this.data.owned; },
    set owned(value) { this.data.owned = value; },
    prereqs: {},
    require: {}, // Default to free.  If this is undefined, makes the item unpurchaseable
    salable: false,
    vulnerable: true,
    effectText: "",
    prestige: false,
    initOwned: 0,  // Override this to undefined to inhibit initialization.  Also determines the type of the 'owned' property.
    init: function(fullInit) { 
        if (fullInit === undefined) { fullInit = true; }
        if (fullInit || !this.prestige)  { 
            this.data = {};
            if (this.initOwned !== undefined) { this.owned = this.initOwned; }
        } 
        return true; 
    },
    reset: function() { return this.init(false); }, // Default reset behavior is to re-init non-prestige items.
    get limit() { return (typeof this.initOwned == "number" ) ? Infinity // Default is no limit for numbers
                       : (typeof this.initOwned == "boolean") ? true : 0; }, // true (1) for booleans, 0 otherwise.
    set limit(value) { return this.limit; }, // Only here for JSLint.
    //xxx This is a hack; it assumes that any CivObj with a getter for its
    // 'require' has a variable cost.  Which is currently true, but might not
    // always be.
    hasVariableCost: function() { 
        var i;
        // If our requirements have a getter, assume variable.
        //xxx This won't work if it inherits a variable desc.
        var requireDesc = Object.getOwnPropertyDescriptor(this,"require");
        if (!requireDesc) { return false; } // Unpurchaseable
        if (requireDesc.get !== undefined) { return true; }
        // If our requirements contain a function, assume variable.
        for(i in this.require) { if (typeof this.require[i] == "function") { return true; } }
        return false;
    },

    // Return the name for the given quantity of this object.
    // Specific 'singular' and 'plural' used if present and appropriate,
    // otherwise returns 'name'.
    getQtyName: function(qty) { 
        if (qty === 1 && this.singular) { return this.singular; }
        if (typeof qty == "number" && this.plural) { return this.plural; }
        return this.name || this.singular || "(UNNAMED)";
    }
};

function Resource(props) // props is an object containing the desired properties.
{
    if (!(this instanceof Resource)) { return new Resource(props); } // Prevent accidental namespace pollution
    CivObj.call(this,props);
    copyProps(this,props,null,true);
    // Occasional Properties: increment, specialChance, net
    return this;
}
Resource.prototype = new CivObj({
    constructor: Resource,
    type: "resource",
    // 'net' accessor always exists, even if the underlying value is undefined for most resources.
    get net() { return this.data.net; },
    set net(value) { this.data.net = value; },
    increment: 0,
    specialChance: 0,
    specialMaterial: "",
    activity: "gathering" //I18N
},true);

function Building(props) // props is an object containing the desired properties.
{
    if (!(this instanceof Building)) { return new Building(props); } // Prevent accidental namespace pollution
    CivObj.call(this,props);
    copyProps(this,props,null,true);
    // Occasional Properties: subType, efficiency, devotion
    // plural should get moved during I18N.
    return this;
}
// Common Properties: type="building",customQtyId
Building.prototype = new CivObj({
    constructor: Building,
    type: "building",
    alignment:"player",
    place: "home",
    get vulnerable() { return this.subType != "altar"; }, // Altars can't be sacked.
    set vulnerable(value) { return this.vulnerable; }, // Only here for JSLint.
    customQtyId: "buildingCustomQty"
},true);

function Upgrade(props) // props is an object containing the desired properties.
{
    if (!(this instanceof Upgrade)) { return new Upgrade(props); } // Prevent accidental namespace pollution
    CivObj.call(this,props);
    copyProps(this,props,null,true);
    // Occasional Properties: subType, efficiency, extraText, onGain
    if (this.subType == "prayer") { this.initOwned = undefined; } // Prayers don't get initial values.
    if (this.subType == "pantheon") { this.prestige = true; } // Pantheon upgrades are not lost on reset.
    return this;
}
// Common Properties: type="upgrade"
Upgrade.prototype = new CivObj({
    constructor: Upgrade,
    type: "upgrade",
    initOwned: false,
    vulnerable: false,
    get limit() { return 1; }, // Can't re-buy these.
    set limit(value) { return this.limit; } // Only here for JSLint.
},true);

function Unit(props) // props is an object containing the desired properties.
{
    if (!(this instanceof Unit)) { return new Unit(props); } // Prevent accidental namespace pollution
    CivObj.call(this,props);
    copyProps(this,props,null,true);
    // Occasional Properties: singular, plural, subType, prereqs, require, effectText, alignment,
    // source, efficiency_base, efficiency, onWin, lootFatigue, killFatigue, killExhaustion, species
    // place, ill
    return this;
}
// Common Properties: type="unit"
Unit.prototype = new CivObj({
    constructor: Unit,
    type: "unit",
    salable: true,
    get customQtyId() { return this.place + "CustomQty"; },
    set customQtyId(value) { return this.customQtyId; }, // Only here for JSLint.
    alignment:"player", // Also: "enemy"
    species: "human", // Also:  "animal", "mechanical", "undead"
    place: "home", // Also:  "party"
    combatType: "",  // Default noncombatant.  Also "infantry","cavalry","animal"
    onWin: function() { return; }, // Do nothing.
    get vulnerable() { return ((this.place == "home")&&(this.alignment=="player")&&(this.subType=="normal")); },
    set vulnerable(value) { return this.vulnerable; }, // Only here for JSLint.
    init: function(fullInit) { CivObj.prototype.init.call(this,fullInit);
        // Right now, only vulnerable human units can get sick.
        if (this.vulnerable && (this.species=="human")) {
            this.illObj = { owned: 0 };
        } 
        return true; 
    },
    //xxx Right now, ill numbers are being stored as a separate structure inside curCiv.
    // It would probably be better to make it an actual 'ill' property of the Unit.
    // That will require migration code.
    get illObj() { return curCiv[this.id+"Ill"]; },
    set illObj(value) { curCiv[this.id+"Ill"] = value; }, 
    get ill() { return isValid(this.illObj) ? this.illObj.owned : undefined; },
    set ill(value) { if (isValid(this.illObj)) { this.illObj.owned = value; } },
    get partyObj() { return civData[this.id+"Party"]; },
    set partyObj(value) { return this.partyObj; }, // Only here for JSLint.
    get party() { return isValid(this.partyObj) ? this.partyObj.owned : undefined; },
    set party(value) { if (isValid(this.partyObj)) { this.partyObj.owned = value; } },
    // Is this unit just some other sort of unit in a different place (but in the same limit pool)?
    isDest: function() { return (this.source !== undefined) && (civData[this.source].partyObj === this); },
    get limit() { return (this.isDest()) ? civData[this.source].limit 
                                             : Object.getOwnPropertyDescriptor(CivObj.prototype,"limit").get.call(this); },
    set limit(value) { return this.limit; }, // Only here for JSLint.

    // The total quantity of this unit, regardless of status or place.
    get total() { return (this.isDest()) ? civData[this.source].total : (this.owned + (this.ill||0) + (this.party||0)); },
    set total(value) { return this.total; } // Only here for JSLint.
},true);

function Achievement(props) // props is an object containing the desired properties.
{
    if (!(this instanceof Achievement)) { return new Achievement(props); } // Prevent accidental namespace pollution
    CivObj.call(this,props);
    copyProps(this,props,null,true);
    // Occasional Properties: test
    return this;
}
// Common Properties: type="achievement"
Achievement.prototype = new CivObj({
    constructor: Achievement,
    type: "achievement",
    initOwned: false,
    prestige : true, // Achievements are not lost on reset.
    vulnerable : false,
    get limit() { return 1; }, // Can't re-buy these.
    set limit(value) { return this.limit; } // Only here for JSLint.
},true);

// Initialize Data
var civData = [
// Resources
new Resource({ id:"food", name:"food", increment:1, specialChance:0.1,
    subType:"basic",
    specialMaterial: "skins", verb: "gather", activity: "foraging", //I18N
    get limit() { return 200 + (civData.barn.owned * (civData.granaries.owned?2:1) * 200); },
    set limit(value) { return this.limit; } // Only here for JSLint.
}),
new Resource({ id:"wood", name:"wood", increment:1, specialChance:0.1,
    subType:"basic",
    specialMaterial: "herbs", verb: "cut", activity: "woodcutting", //I18N
    get limit() { return 200 + (civData.woodstock.owned  * 200); },
    set limit(value) { return this.limit; } // Only here for JSLint.
}),
new Resource({ id:"stone", name:"stone", increment:1, specialChance:0.1,
    subType:"basic",
    specialMaterial: "ore", verb: "mine", activity: "mining", //I18N
    get limit() { return 200 + (civData.stonestock.owned  * 200); },
    set limit(value) { return this.limit; } // Only here for JSLint.
}),
new Resource({ id:"skins", singular:"skin", plural:"skins"}),
new Resource({ id:"herbs", singular:"herb", plural:"herbs" }),
new Resource({ id:"ore", name:"ore" }),
new Resource({ id:"leather", name:"leather" }),
new Resource({ id:"metal", name:"metal" }),
new Resource({ id:"piety", name:"piety", vulnerable:false }), // Can't be stolen
new Resource({ id:"gold", name:"gold", vulnerable:false }), // Can't be stolen
new Resource({ id:"corpses", singular:"corpse", plural:"corpses", vulnerable:false }), // Can't be stolen
new Resource({ id:"devotion", name:"devotion", vulnerable:false }), // Can't be stolen
// Buildings
new Building({ id:"freeLand", name:"free land", plural:"free land", 
    subType: "land",
    prereqs: undefined,  // Cannot be purchased.
    require: undefined,  // Cannot be purchased.
    vulnerable:false, // Cannot be stolen
    initOwned:1000,  
    effectText:"Conquer more from your neighbors." }),
new Building({ id:"tent", singular:"tent", plural:"tents",
    require: { wood:2, skins:2 },
    effectText:"+1 max pop." }),
new Building({ id:"hut", singular:"wooden hut", plural:"wooden huts",
    require : { wood:20, skins:1 },
    effectText:"+3 max pop." }),
new Building({ id:"cottage", singular:"cottage", plural:"cottages",
    prereqs:{ masonry: true },
    require:{ wood:10, stone:30 },
    effectText:"+6 max pop." }),
new Building({ id:"house", singular:"house", plural:"houses",
    prereqs:{ construction: true },
    require:{ wood:30, stone:70 },
    get effectText() { var num = 10 + 2*(civData.slums.owned + civData.tenements.owned); return "+"+num+" max pop."; },
    set effectText(value) { return this.require; }, // Only here for JSLint.
    update: function() { document.getElementById(this.id+"Note").innerHTML = ": "+this.effectText; } }),
new Building({ id:"mansion", singular:"mansion", plural:"mansions",
    prereqs:{ architecture: true },
    require:{ wood:200, stone:200, leather:20 },
    effectText:"+50 max pop." }),
new Building({ id:"barn", singular:"barn", plural:"barns",
    require:{ wood:100 },
    effectText:"+200 food storage" }),
new Building({ id:"woodstock", singular:"wood stockpile", plural:"wood stockpiles",
    require:{ wood:100 },
    effectText:"+200 wood storage" }),
new Building({ id:"stonestock", singular:"stone stockpile", plural:"stone stockpiles",
    require:{ wood:100 },
    effectText:"+200 stone storage" }),
new Building({ id:"tannery", singular:"tannery", plural:"tanneries",
    prereqs:{ masonry: true },
    require:{ wood:30, stone:70, skins:2 },
    effectText:"allows 1 tanner" }),
new Building({ id:"smithy", singular:"smithy", plural:"smithies",
    prereqs:{ masonry: true },
    require:{ wood:30, stone:70, ore:2 },
    effectText:"allows 1 blacksmith" }),
new Building({ id:"apothecary", singular:"apothecary", plural:"apothecaries",
    prereqs:{ masonry: true },
    require:{ wood:30, stone:70, herbs:2 },
    effectText:"allows 1 healer" }),
new Building({ id:"temple", singular:"temple", plural:"temples",
    prereqs:{ masonry: true },
    require:{ wood:30, stone:120 },
    effectText:"allows 1 cleric",
    // If purchase was a temple and aesthetics has been activated, increase morale
    // If population is large, temples have less effect.
    onGain: function(num) { if (civData.aesthetics && civData.aesthetics.owned && num) { adjustMorale(num * 25 / population.current); } }}),
new Building({ id:"barracks", name:"barracks",
    prereqs:{ masonry: true },
    require:{ food:20, wood:60, stone:120, metal:10 },
    effectText:"allows 10 soldiers" }),
new Building({ id:"stable", singular:"stable", plural:"stables",
    prereqs:{ horseback: true },
    require:{ food:60, wood:60, stone:120, leather:10 },
    effectText:"allows 10 cavalry" }),
new Building({ id:"graveyard", singular:"graveyard", plural:"graveyards",
    prereqs:{ masonry: true },
    require:{ wood:50, stone:200, herbs:50 },
    vulnerable: false, // Graveyards can't be sacked
    effectText:"contains 100 graves",
    onGain: function(num) { if (num === undefined) { num = 1; } digGraves(num); }}),
new Building({ id:"mill", singular:"mill", plural:"mills",
    prereqs:{ wheel: true },
    get require() { return { wood  : 100 * (this.owned + 1) * Math.pow(1.05,this.owned),
                             stone : 100 * (this.owned + 1) * Math.pow(1.05,this.owned) }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"improves farmers" }),
new Building({ id:"fortification", singular:"fortification", plural:"fortifications", efficiency: 0.01,
    prereqs:{ architecture: true },
    //xxx This is testing a new technique that allows a function for the cost items.
    // Eventually, this will take a qty parameter
    get require() { return { stone : function() { return 100 * (this.owned + 1) * Math.pow(1.05,this.owned); }.bind(this) }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"helps protect against attack" }),
// Altars
// The 'name' on the altars is really the label on the button to make them.
//xxx This should probably change.
new Building({ id:"battleAltar", name:"Build Altar", singular:"battle altar", plural:"battle altars", 
    subType: "altar", devotion:1,
    prereqs:{ deity: "battle" },
    get require() { return { stone:200, piety:200, metal : 50 + (50 * this.owned) }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"+1 Devotion" }),
new Building({ id:"fieldsAltar", name:"Build Altar", singular:"fields altar", plural:"fields altars", 
    subType: "altar", devotion:1,
    prereqs:{ deity: "fields" },
    get require() { return { stone:200, piety:200,
            food : 500 + (250 * this.owned), wood : 500 + (250 * this.owned) }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"+1 Devotion" }),
new Building({ id:"underworldAltar", name:"Build Altar", singular:"underworld altar", plural:"underworld altars",
    subType: "altar", devotion:1,
    prereqs:{ deity: "underworld" },
    get require() { return { stone:200, piety:200, corpses : 1 + this.owned }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"+1 Devotion" }),
new Building({ id:"catAltar", name:"Build Altar", singular:"cat altar", plural:"cat altars", 
    subType: "altar", devotion:1,
    prereqs:{ deity: "cats" },
    get require() { return { stone:200, piety:200, herbs : 100 + (50 * this.owned) }; },
    set require(value) { return this.require; }, // Only here for JSLint.
    effectText:"+1 Devotion" }),
// Upgrades
new Upgrade({ id:"skinning", name:"Skinning", subType: "upgrade",
    require: { skins: 10 },
    effectText:"Farmers can collect skins" }),
new Upgrade({ id:"harvesting", name:"Harvesting", subType: "upgrade",
    require: { herbs: 10 },
    effectText:"Woodcutters can collect herbs" }),
new Upgrade({ id:"prospecting", name:"Prospecting", subType: "upgrade",
    require: { ore: 10 },
    effectText:"Miners can collect ore" }),
new Upgrade({ id:"domestication", name:"Domestication", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { leather: 20 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"ploughshares", name:"Ploughshares", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { metal:20 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"irrigation", name:"Irrigation", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 500, stone: 200 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"butchering", name:"Butchering", subType: "upgrade",
    prereqs:{ construction: true, skinning: true },
    require: { leather: 40 },
    effectText:"More farmers collect more skins" }),
new Upgrade({ id:"gardening", name:"Gardening", subType: "upgrade",
    prereqs:{ construction: true, harvesting: true },
    require: { herbs: 40 },
    effectText:"More woodcutters collect more herbs" }),
new Upgrade({ id:"extraction", name:"Extraction", subType: "upgrade",
    prereqs:{ construction: true, prospecting: true },
    require: { metal: 40 },
    effectText:"More miners collect more ore" }),
new Upgrade({ id:"flensing", name:"Flensing", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { metal: 1000 },
    effectText:"Collect skins more frequently" }),
new Upgrade({ id:"macerating", name:"Macerating", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { leather: 500, stone: 500 },
    effectText:"Collect ore more frequently" }),
new Upgrade({ id:"croprotation", name:"Crop Rotation", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { herbs: 5000, piety: 1000 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"selectivebreeding", name:"Selective Breeding", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { skins: 5000, piety: 1000 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"fertilisers", name:"Fertilisers", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { ore: 5000, piety: 1000 },
    effectText:"Increase farmer food output" }),
new Upgrade({ id:"masonry", name:"Masonry", subType: "upgrade",
    require: { wood: 100, stone: 100 },
    effectText:"Unlock more buildings and upgrades" }),
new Upgrade({ id:"construction", name:"Construction", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 1000, stone: 1000 },
    effectText:"Unlock more buildings and upgrades" }),
new Upgrade({ id:"architecture", name:"Architecture", subType: "upgrade",
    prereqs:{ construction: true },
    require: { wood: 10000, stone: 10000 },
    effectText:"Unlock more buildings and upgrades" }),
new Upgrade({ id:"tenements", name:"Tenements", subType: "upgrade",
    prereqs:{ construction: true },
    require: { food: 200, wood: 500, stone: 500 },
    effectText:"Houses support +2 workers",
    onGain: function() { updatePopulationUI(); } //due to population limits changing
}),
new Upgrade({ id:"slums", name:"Slums", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { food: 500, wood: 1000, stone: 1000 },
    effectText:"Houses support +2 workers",
    onGain: function() { updatePopulationUI(); } //due to population limits changing
}),
new Upgrade({ id:"granaries", name:"Granaries", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 1000, stone: 1000 },
    effectText:"Barns store double the amount of food",
    onGain: function() { updateResourceTotals(); } //due to resource limits increasing
}),
new Upgrade({ id:"palisade", name:"Palisade", subType: "upgrade",
    efficiency: 0.01, // Subtracted from attacker efficiency.
    prereqs:{ construction: true },
    require: { wood: 2000, stone: 1000 },
    effectText:"Enemies do less damage" }),
new Upgrade({ id:"weaponry", name:"Basic Weaponry", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 500, metal: 500 },
    effectText:"Improve soldiers" }),
new Upgrade({ id:"shields", name:"Basic Shields", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 500, leather: 500 },
    effectText:"Improve soldiers" }),
new Upgrade({ id:"horseback", name:"Horseback Riding", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { food: 500, wood: 500 },
    effectText:"Build stables" }),
new Upgrade({ id:"wheel", name:"The Wheel", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { wood: 500, stone: 500 },
    effectText:"Build mills" }),
new Upgrade({ id:"writing", name:"Writing", subType: "upgrade",
    prereqs:{ masonry: true },
    require: { skins: 500 },
    effectText:"Increase cleric piety generation" }),
new Upgrade({ id:"administration", name:"Administration", subType: "upgrade",
    prereqs:{ writing: true },
    require: { stone: 1000, skins: 1000 },
    effectText:"Increase land gained from raiding" }),
new Upgrade({ id:"codeoflaws", name:"Code of Laws", subType: "upgrade",
    prereqs:{ writing: true },
    require: { stone: 1000, skins: 1000 },
    effectText:"Reduce unhappiness caused by overcrowding" }),
new Upgrade({ id:"mathematics", name:"Mathematics", subType: "upgrade",
    prereqs:{ writing: true },
    require: { herbs: 1000, piety: 1000 },
    effectText:"Create siege engines" }),
new Upgrade({ id:"aesthetics", name:"Aesthetics", subType: "upgrade",
    prereqs:{ writing: true },
    require: { piety: 5000 },
    effectText:"Building temples increases morale" }),
new Upgrade({ id:"civilservice", name:"Civil Service", subType: "upgrade",
    prereqs:{ architecture: true },
    require: { piety: 5000 },
    effectText:"Increase basic resources from clicking" }),
new Upgrade({ id:"feudalism", name:"Feudalism", subType: "upgrade",
    prereqs:{ civilservice: true },
    require: { piety: 10000 },
    effectText:"Further increase basic resources from clicking" }),
new Upgrade({ id:"guilds", name:"Guilds", subType: "upgrade",
    prereqs:{ civilservice: true },
    require: { piety: 10000 },
    effectText:"Increase special resources from clicking" }),
new Upgrade({ id:"serfs", name:"Serfs", subType: "upgrade",
    prereqs:{ civilservice: true },
    require: { piety: 20000 },
    effectText:"Idle workers increase resources from clicking" }),
new Upgrade({ id:"nationalism", name:"Nationalism", subType: "upgrade",
    prereqs:{ civilservice: true },
    require: { piety: 50000 },
    effectText:"Soldiers increase basic resources from clicking" }),
new Upgrade({ id:"worship", name:"Worship", subType: "deity",
    prereqs:{ temple: 1 },
    require: { piety: 1000 },
    effectText:"Begin worshipping a deity (requires temple)",
    onGain: function() {
        updateUpgrades();
        renameDeity(); //Need to add in some handling for when this returns NULL.
    } }),
// Pantheon Upgrades
new Upgrade({ id:"lure", name:"Lure of Civilisation", subType: "pantheon",
    prereqs:{ deity: "cats", devotion: 10 },
    require: { piety: 1000 },
    effectText:"increase chance to get cats" }),
new Upgrade({ id:"companion", name:"Warmth of the Companion", subType: "pantheon",
    prereqs:{ deity: "cats", devotion: 30 },
    require: { piety: 1000 },
    effectText:"cats help heal the sick" }),
new Upgrade({ id:"comfort", name:"Comfort of the Hearthfires", subType: "pantheon",
    prereqs:{ deity: "cats", devotion: 50 },
    require: { piety: 5000 },
    effectText:"traders marginally more frequent" }),
new Upgrade({ id:"blessing", name:"Blessing of Abundance", subType: "pantheon",
    prereqs:{ deity: "fields", devotion: 10 },
    require: { piety: 1000 },
    effectText:"increase farmer food output" }),
new Upgrade({ id:"waste", name:"Abide No Waste", subType: "pantheon",
    prereqs:{ deity: "fields", devotion: 30 },
    require: { piety: 1000 },
    effectText:"workers will eat corpses if there is no food left" }),
new Upgrade({ id:"stay", name:"Stay With Us", subType: "pantheon",
    prereqs:{ deity: "fields", devotion: 50 },
    require: { piety: 5000 },
    effectText:"traders stay longer" }),
new Upgrade({ id:"riddle", name:"Riddle of Steel", subType: "pantheon",
    prereqs:{ deity: "battle", devotion: 10 },
    require: { piety: 1000 },
    effectText:"improve soldiers" }),
new Upgrade({ id:"throne", name:"Throne of Skulls", subType: "pantheon",
    prereqs:{ deity: "battle", devotion: 30 },
    require: { piety: 1000 },
    init: function(fullInit) { Upgrade.prototype.init.call(this,fullInit); this.count = 0; },
    get count() { return this.data.count; }, // Partial temples from Throne
    set count(value) { this.data.count = value; },
    effectText:"slaying enemies creates temples" }),
new Upgrade({ id:"lament", name:"Lament of the Defeated", subType: "pantheon",
    prereqs:{ deity: "battle", devotion: 50 },
    require: { piety: 5000 },
    effectText:"Successful raids delay future invasions" }),
new Upgrade({ id:"book", name:"The Book of the Dead", subType: "pantheon",
    prereqs:{ deity: "underworld", devotion: 10 },
    require: { piety: 1000 },
    effectText:"gain piety with deaths" }),
new Upgrade({ id:"feast", name:"A Feast for Crows", subType: "pantheon",
    prereqs:{ deity: "underworld", devotion: 30 },
    require: { piety: 1000 },
    effectText:"corpses are less likely to cause illness" }),
new Upgrade({ id:"secrets", name:"Secrets of the Tombs", subType: "pantheon",
    prereqs:{ deity: "underworld", devotion: 50 },
    require: { piety: 5000 },
    effectText:"graveyards increase cleric piety generation" }),
// Special Upgrades
new Upgrade({ id:"standard", name:"Battle Standard", subType: "conquest",
    prereqs:{ barracks: 1 },
    require: { leather: 1000, metal: 1000 },
    effectText:"Lets you build an army (requires barracks)" }),
new Upgrade({ id:"trade", name:"Trade", subType: "trade",
    prereqs: { gold: 1 }, 
    require: { gold: 1 }, 
    effectText:"Open the trading post" }),
new Upgrade({ id:"currency", name:"Currency", subType: "trade",
    require: { ore: 1000, gold: 10 }, 
    effectText:"Traders arrive more frequently, stay longer" }),
new Upgrade({ id:"commerce", name:"Commerce", subType: "trade",
    require: { piety: 10000, gold: 100 }, 
    effectText:"Traders arrive more frequently, stay longer" }),
// Prayers
new Upgrade({ id:"smite", name:"Smite Invaders", subType: "prayer",
    prereqs:{ deity: "battle", devotion: 20 },
    require: { piety: 100 },
    effectText:"(per invader killed)" }),
new Upgrade({ id:"glory", name:"For Glory!", subType: "prayer",
    prereqs:{ deity: "battle", devotion: 40 },
    require: { piety: 1000 }, 
    init: function(fullInit) { Upgrade.prototype.init.call(this,fullInit); this.data.timer = 0; },
    get timer() { return this.data.timer; }, // Glory time left (sec)
    set timer(value) { this.data.timer = value; },
    effectText:"Temporarily makes raids more difficult, increases rewards" }),
new Upgrade({ id:"wickerman", name:"Burn Wicker Man", subType: "prayer",
    prereqs:{ deity: "fields", devotion: 20 },
    require: { wood: 500 },  //xxx +1 Worker
    effectText:"Sacrifice 1 worker to gain a random bonus to a resource" }),
new Upgrade({ id:"walk", name:"Walk Behind the Rows", subType: "prayer",
    prereqs:{ deity: "fields", devotion: 40 },
    require: { }, //xxx 1 Worker/sec
    init: function(fullInit) { Upgrade.prototype.init.call(this,fullInit); this.rate = 0; },
    get rate() { return this.data.rate; }, // Sacrifice rate
    set rate(value) { this.data.rate = value; },
    effectText:"boost food production by sacrificing 1 worker/sec.",
    extraText: "<br /><button id='ceaseWalk' onmousedown='walk(false)' disabled='disabled'>Cease Walking</button>" }),
new Upgrade({ id:"raiseDead", name:"Raise Dead", subType: "prayer",
    prereqs:{ deity: "underworld", devotion: 20 },
    require: { corpses: 1, piety: 4 }, //xxx Nonlinear cost
    effectText:"Piety to raise the next zombie",
    extraText:"<button onmousedown='raiseDead(100)' id='raiseDead100' class='x100' disabled='disabled'"
              +">+100</button><button onmousedown='raiseDead(Infinity)' id='raiseDeadMax' class='xInfinity' disabled='disabled'>+&infin;</button>" }),
new Upgrade({ id:"summonShade", name:"Summon Shades", subType: "prayer",
    prereqs:{ deity: "underworld", devotion: 40 },
    require: { piety: 1000 },  //xxx Also need slainEnemies
    effectText:"Souls of the defeated rise to fight for you" }),
new Upgrade({ id:"pestControl", name:"Pest Control", subType: "prayer",
    prereqs:{ deity: "cats", devotion: 20 },
    require: { piety: 100 }, 
    init: function(fullInit) { Upgrade.prototype.init.call(this,fullInit); this.timer = 0; },
    get timer() { return this.data.timer; }, // Pest hunting time left
    set timer(value) { this.data.timer = value; },
    effectText:"Give temporary boost to food production" }),
new Upgrade({ id:"grace", name:"Grace", subType: "prayer",
    prereqs:{ deity: "cats", devotion: 40 },
    require: { piety: 1000 }, //xxx This is not fixed; see curCiv.graceCost
    init: function(fullInit) { Upgrade.prototype.init.call(this,fullInit); this.cost = 1000; },
    get cost() { return this.data.cost; }, // Increasing cost to use Grace to increase morale.
    set cost(value) { this.data.cost = value; },
    effectText:"Increase Morale" }),
// Units
new Unit({ id:"totalSick", singular:"sick worker", plural:"sick workers", subType:"special",
    prereqs: undefined,  // Hide until we get one.
    require: undefined,  // Cannot be purchased.
    salable: false,  // Cannot be sold.
    //xxx This (alternate data location) could probably be cleaner.
    get owned() { return population[this.id]; },
    set owned(value) { population[this.id]= value; },
    init: function() { this.owned = this.initOwned; }, //xxx Verify this override is needed.
    effectText:"Use healers and herbs to cure them" }),
new Unit({ id:"unemployed", singular:"idle worker", plural:"idle workers",
    require: undefined,  // Cannot be purchased (through normal controls) xxx Maybe change this?
    salable: false,  // Cannot be sold.
    customQtyId:"spawnCustomQty",
    effectText:"Playing idle games" }),
new Unit({ id:"farmer", singular:"farmer", plural:"farmers",
    source:"unemployed",
    efficiency_base: 0.2,
    get efficiency() { return this.efficiency_base + (0.1 * (
    + civData.domestication.owned + civData.ploughshares.owned + civData.irrigation.owned 
    + civData.croprotation.owned + civData.selectivebreeding.owned + civData.fertilisers.owned 
    + civData.blessing.owned)); },
    set efficiency(value) { this.efficiency_base = value; },
    effectText:"Automatically gather food" }),
new Unit({ id:"woodcutter", singular:"woodcutter", plural:"woodcutters",
    source:"unemployed",
    efficiency: 0.5,
    effectText:"Automatically gather wood" }),
new Unit({ id:"miner", singular:"miner", plural:"miners",
    source:"unemployed",
    efficiency: 0.2,
    effectText:"Automatically gather stone" }),
new Unit({ id:"tanner", singular:"tanner", plural:"tanners",
    source:"unemployed",
    efficiency: 0.5,
    prereqs:{ tannery: 1 },
    get limit() { return civData.tannery.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    effectText:"Convert skins to leather" }),
new Unit({ id:"blacksmith", singular:"blacksmith", plural:"blacksmiths",
    source:"unemployed",
    efficiency: 0.5,
    prereqs:{ smithy: 1 },
    get limit() { return civData.smithy.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    effectText:"Convert ore to metal" }),
new Unit({ id:"healer", singular:"healer", plural:"healers",
    source:"unemployed",
    efficiency: 0.1,
    prereqs:{ apothecary: 1 },
    init: function(fullInit) { Unit.prototype.init.call(this,fullInit); this.cureCount = 0; },
    get limit() { return civData.apothecary.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    get cureCount() { return this.data.cureCount; }, // Carryover fractional healing
    set cureCount(value) { this.data.cureCount = value; }, // Only here for JSLint.
    effectText:"Cure sick workers" }),
new Unit({ id:"cleric", singular:"cleric", plural:"clerics",
    source:"unemployed",
    efficiency: 0.05,
    prereqs:{ temple: 1 },
    get limit() { return civData.temple.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    effectText:"Generate piety, bury corpses" }),
new Unit({ id:"labourer", singular:"labourer", plural:"labourers",
    source:"unemployed",
    efficiency: 1.0,
    prereqs:{ wonderStage: 1 }, //xxx This is a hack
    effectText:"Use resources to build wonder" }),
new Unit({ id:"soldier", singular:"soldier", plural:"soldiers",
    source:"unemployed",
    combatType:"infantry", 
    efficiency_base: 0.05,
    get efficiency() { return this.efficiency_base + playerCombatMods(); },
    set efficiency(value) { this.efficiency_base = value; },
    prereqs:{ barracks: 1 },
    require:{ leather:10, metal:10 },
    get limit() { return 10*civData.barracks.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    effectText:"Protect from attack" }),
new Unit({ id:"cavalry", singular:"cavalry", plural:"cavalry",
    source:"unemployed",
    combatType:"cavalry", 
    efficiency_base: 0.08,
    get efficiency() { return this.efficiency_base + playerCombatMods(); },
    set efficiency(value) { this.efficiency_base = value; },
    prereqs:{ stable: 1 },
    require:{ food:20, leather:20 },
    get limit() { return 10*civData.stable.owned; },
    set limit(value) { return this.limit; }, // Only here for JSLint.
    effectText:"Protect from attack" }),
new Unit({ id:"cat", singular:"cat", plural:"cats", subType:"special",
    require: undefined,  // Cannot be purchased (through normal controls)
    prereqs:{ cat: 1 }, // Only visible if you have one.
    prestige : true, // Not lost on reset.
    salable: false,  // Cannot be sold.
    species:"animal",
    effectText:"Our feline companions" }),
new Unit({ id:"shade", singular:"shade", plural:"shades", subType:"special",
    prereqs: undefined,  // Cannot be purchased (through normal controls) xxx Maybe change this?
    require: undefined,  // Cannot be purchased.
    salable: false,  // Cannot be sold.
    species:"undead",
    effectText:"Insubstantial spirits" }),
new Unit({ id:"wolf", singular:"wolf", plural:"wolves",
    alignment:"enemy",
    combatType:"animal", 
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.05,
    onWin: function() { doSlaughter(this); },
    killFatigue:(1.0), // Max fraction that leave after killing the last person
    killExhaustion:(1/2), // Chance of an attacker leaving after killing a person
    species:"animal",
    effectText:"Eat your workers" }),
new Unit({ id:"bandit", singular:"bandit", plural:"bandits",
    alignment:"enemy",
    combatType:"infantry", 
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.07,
    onWin: function() { doLoot(this); },
    lootFatigue:(1/8), // Max fraction that leave after cleaning out a resource
    effectText:"Steal your resources" }),
new Unit({ id:"barbarian", singular:"barbarian", plural:"barbarians",
    alignment:"enemy",
    combatType:"infantry", 
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.09,
    onWin: function() { doHavoc(this); },
    lootFatigue:(1/24), // Max fraction that leave after cleaning out a resource
    killFatigue:(1/3), // Max fraction that leave after killing the last person
    killExhaustion:(1.0), // Chance of an attacker leaving after killing a person
    effectText:"Slaughter, plunder, and burn" }),
new Unit({ id:"esiege", singular:"siege engine", plural:"siege engines",
    alignment:"enemy",
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.1,  // 10% chance to hit
    species:"mechanical",
    effectText:"Destroy your fortifications" }),
new Unit({ id:"soldierParty", singular:"soldier", plural:"soldiers",
    source:"soldier",
    combatType:"infantry", 
    efficiency_base: 0.05,
    get efficiency() { return this.efficiency_base + playerCombatMods(); },
    set efficiency(value) { this.efficiency_base = value; },
    prereqs:{ standard: true, barracks: 1 },
    place: "party",
    effectText:"Your raiding party" }),
new Unit({ id:"cavalryParty", name:"cavalry",
    source:"cavalry",
    combatType:"cavalry", 
    efficiency_base: 0.08,
    get efficiency() { return this.efficiency_base + playerCombatMods(); },
    set efficiency(value) { this.efficiency_base = value; },
    prereqs:{ standard: true, stable: 1 },
    place: "party",
    effectText:"Your mounted raiders" }),
new Unit({ id:"siege", singular:"siege engine", plural:"siege engines",
    efficiency: 0.1, // 10% chance to hit
    prereqs:{ standard: true, mathematics: true },
    require:{ wood:200, leather:50, metal:50 },
    species:"mechanical",
    place: "party",
    salable: false,
    effectText:"Destroy enemy fortifications" }),
new Unit({ id:"esoldier", singular:"soldier", plural:"soldiers",
    alignment:"enemy",
    combatType:"infantry", 
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.05,
    place: "party",
    effectText:"Defending enemy troops" }),
/* Not currently used.
new Unit({ id:"ecavalry", name:"cavalry",
    alignment:"enemy",
    combatType:"cavalry", 
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.08,
    place: "party",
    effectText:"Mounted enemy troops" }),
*/
new Unit({ id:"efort", singular:"fortification", plural:"fortifications",
    alignment:"enemy",
    prereqs: undefined, // Cannot be purchased.
    efficiency: 0.01, // -1% damage
    species:"mechanical",
    place: "party",
    effectText:"Reduce enemy casualties"}),
// Achievements
    //conquest
new Achievement({id:"raiderAch"    , name:"Raider"         , test:function() { return curCiv.raid.victory; }}),
    //xxx Technically this also gives credit for capturing a siege engine.
new Achievement({id:"engineerAch"  , name:"Engi&shy;neer"  , test:function() { return civData.siege.owned > 0; }}),
    // If we beat the largest possible opponent, grant bonus achievement.
new Achievement({id:"dominationAch", name:"Domi&shy;nation", test:function() { return curCiv.raid.victory && (curCiv.raid.last == civSizes[civSizes.length-1].id); }}),
    //Morale
new Achievement({id:"hatedAch"     , name:"Hated"          , test:function() { return curCiv.morale.efficiency <= 0.5; }}),
new Achievement({id:"lovedAch"     , name:"Loved"          , test:function() { return curCiv.morale.efficiency >= 1.5; }}),
    //cats
new Achievement({id:"catAch"       , name:"Cat!"           , test:function() { return civData.cat.owned >= 1; }}),
new Achievement({id:"glaringAch"   , name:"Glaring"        , test:function() { return civData.cat.owned >= 10; }}),
new Achievement({id:"clowderAch"   , name:"Clowder"        , test:function() { return civData.cat.owned >= 100; }}),
    //other population
    //Plagued achievement requires sick people to outnumber healthy
new Achievement({id:"plaguedAch"   , name:"Plagued"        , test:function() { return population.totalSick > population.healthy; }}),
new Achievement({id:"ghostTownAch" , name:"Ghost Town"     , test:function() { return (population.current === 0) && (population.limit >= 1000); }}),
    //deities
    //xxx TODO: Should make this loop through the domains
new Achievement({id:"battleAch"    , name:"Battle"         , test:function() { return getCurDeityDomain() == "battle"; }}),
new Achievement({id:"fieldsAch"    , name:"Fields"         , test:function() { return getCurDeityDomain() == "fields"; }}),
new Achievement({id:"underworldAch", name:"Under&shy;world", test:function() { return getCurDeityDomain() == "underworld"; }}),
new Achievement({id:"catsAch"      , name:"Cats"           , test:function() { return getCurDeityDomain() == "cats"; }}),
    //xxx It might be better if this checked for all domains in the Pantheon at once (no iconoclasming old ones away).
new Achievement({id:"fullHouseAch" , name:"Full House"     , test:function() { return civData.battleAch.owned && civData.fieldsAch.owned && civData.underworldAch.owned && civData.catsAch.owned; }}),
    //wonders
new Achievement({id:"wonderAch"    , name:"Wonder"         , test:function() { return curCiv.curWonder.stage === 3; }}),
new Achievement({id:"sevenAch"     , name:"Seven!"         , test:function() { return curCiv.wonders.length >= 7; }}),
    //trading
new Achievement({id:"merchantAch"  , name:"Merch&shy;ant"  , test:function() { return civData.gold.owned > 0; }}),
new Achievement({id:"rushedAch"    , name:"Rushed"         , test:function() { return curCiv.curWonder.rushed; }}),
    //other
new Achievement({id:"neverclickAch", name:"Never&shy;click", test:function() { return curCiv.curWonder.stage === 3 && curCiv.resourceClicks <= 22; }})
];

function augmentCivData() {
    var i;
    var testCivSizeAch = function() { return (this.id == civSizes.getCivSize(population.current).id+"Ach"); };
    // Add the civ size based achivements to the front of the data, so that they come first.
    for (i=civSizes.length-1;i>0;--i) {
        civData.unshift(new Achievement({id:civSizes[i].id+"Ach", name:civSizes[i].name, test:testCivSizeAch}));
    }
    //xxx TODO: Add deity domain based achievements here too.
}
augmentCivData();

// Create 'civData.foo' entries as aliases for the civData element with 
// id = "foo".  This makes it a lot easier to refer to the array
// elements in a readable fashion.
indexArrayByAttr(civData,"id");

// Initialize our data. //xxx Should this move to initCivclicker()?
civData.forEach( function(elem){ if (elem instanceof CivObj) { elem.init(); } });

// Build a variety of additional indices so that we can iterate over specific
// subsets of our civ objects.
var resourceData= []; // All resources
var buildingData= []; // All buildings
var upgradeData = []; // All upgrades
var powerData = []; // All 'powers' //xxx This needs refinement.
var unitData = []; // All units
var achData = []; // All achievements
var sackable= []; // All buildings that can be destroyed
var lootable= []; // All resources that can be stolen
var killable= []; // All units that can be destroyed
var homeBuildings= []; // All buildings to be displayed in the home area
var homeUnits= []; // All units to be displayed in the home area
var armyUnits= []; // All units to be displayed in the army area
var basicResources= []; // All basic (click-to-get) resources
var normalUpgrades= []; // All upgrades to be listed in the normal upgrades area
civData.forEach( function(elem){ 
    if (!(elem instanceof CivObj)) { return; }  // Unknown type
    if (elem.type == "resource") { resourceData.push(elem); 
        if (elem.vulnerable === true) { lootable.push(elem); }
        if (elem.subType == "basic") { basicResources.push(elem); } } 
    if (elem.type == "building") { buildingData.push(elem); 
        if (elem.vulnerable === true) { sackable.push(elem); }
        if (elem.subType == "normal" || elem.subType == "land") { homeBuildings.push(elem); } }
    if (elem.subType == "prayer") { powerData.push(elem); }
    else if (elem.type == "upgrade") { upgradeData.push(elem); 
        if (elem.subType == "upgrade") { normalUpgrades.push(elem); } }
    if (elem.type == "unit") { unitData.push(elem); 
        if (elem.vulnerable === true) { killable.push(elem); }
        if (elem.place == "home") { homeUnits.push(elem); }
        if (elem.place == "party") { armyUnits.push(elem); } }
    if (elem.type == "achievement") { achData.push(elem); }
});


// The resources that Wonders consume, and can give bonuses for.
var wonderResources = [civData.food,civData.wood,civData.stone,civData.skins,civData.herbs,civData.ore,
                       civData.leather,civData.metal,civData.piety];

// Reset the raid data.
function resetRaiding()
{
    curCiv.raid.raiding = false;
    curCiv.raid.victory = false;
    curCiv.raid.epop = 0;
    curCiv.raid.plunderLoot = {};
    curCiv.raid.last = "";

    // Also reset the enemy party units.
    unitData.filter(function(elem) { return ((elem.alignment == "enemy") && (elem.place == "party")); })
            .forEach(function(elem) { elem.reset(); });
}

// These are settings that should probably be tied to the browser.
var settings = {
    autosave : true,
    autosaveCounter : 1,
    autosaveTime : 60, //Currently autosave is every minute. Might change to 5 mins in future.
    customIncr : false,
    fontSize : 1.0,
    delimiters : true,
    textShadow : false,
    notes : true,
    worksafe : false,
    useIcons : true
};

var body = document.getElementsByTagName("body")[0];

function playerCombatMods() { return (0.01 * ((civData.riddle.owned) + (civData.weaponry.owned) + (civData.shields.owned))); }

// Get an object's requirements in text form.
// Pass it a cost object and optional quantity
function getReqText(costObj, qty)
{
    if (!isValid(qty)) { qty = 1; }
    costObj = valOf(costObj,qty); // valOf evals it if it's a function
    if (!isValid(costObj)) { return ""; }

    var i, num;
    var text = "";
    for(i in costObj)
    {
        // If the cost is a function, eval it with qty as a param.  Otherwise
        // just multiply by qty.
        num = (typeof costObj[i] == "function") ? (costObj[i](qty)) : (costObj[i]*qty);
        if (!num) { continue; }
        if (text) { text += ", "; }
        text += prettify(Math.round(num)) + " " + civData[i].getQtyName(num);
    }

    return text;
}

// Returns when the player meets the given upgrade prereqs.
// Undefined prereqs are assumed to mean the item is unpurchasable
function meetsPrereqs(prereqObj)
{
    if (!isValid(prereqObj)) { return false; }
    var i;
    for(i in prereqObj)
    {
        //xxx HACK:  Ugly special checks for non-upgrade pre-reqs.
        // This should be simplified/eliminated once the resource
        // system is unified.
        if (i === "deity") { // Deity
            if (getCurDeityDomain() != prereqObj[i]) { return false; }
        } else if (i === "wonderStage") { //xxx Hack to check if we're currently building a wonder.
            if (curCiv.curWonder.stage !== prereqObj[i]) { return false; }
        } else if (isValid(civData[i]) && isValid(civData[i].owned)) { // Resource/Building/Upgrade
            if (civData[i].owned < prereqObj[i]) { return false; }
        }
    }

    return true;
}


// Returns how many of this item the player can afford.
// Looks only at the item's cost and the player's resources, and not
// at any other limits.
// Negative quantities are always fully permitted.
// An undefined cost structure is assumed to mean it cannot be purchased.
// A boolean quantity is converted to +1 (true) -1 (false)
//xxx Caps nonlinear purchases at +1, blocks nonlinear sales.
// costObj - The cost substructure of the object to purchase
function canAfford(costObj, qty)
{
    if (!isValid(costObj)) { return 0; }
    if (qty === undefined) { qty = Infinity; } // default to as many as we can
    if (qty === false) { qty = -1; } // Selling back a boolean item.
    var i;
    for(i in costObj)
    {
        if (costObj[i] === 0) { continue; }

        //xxx We don't handle nonlinear costs here yet.
        // Cap nonlinear purchases to one at a time.
        // Block nonlinear sales.
        if (typeof costObj[i] == "function") { qty = Math.max(0,Math.min(1,qty)); }

        qty = Math.min(qty,Math.floor(civData[i].owned/valOf(costObj[i])));
        if (qty === 0) { return qty; }
    }

    return qty;
}

// Tries to pay for the specified quantity of the given cost object.
// Pays for fewer if the whole amount cannot be paid.
// Return the quantity that could be afforded.
//xxx DOES NOT WORK for nonlinear building cost items!
function payFor(costObj, qty)
{
    if (qty === undefined) { qty = 1; } // default to 1
    if (qty === false) { qty = -1; } // Selling back a boolean item.
    costObj = valOf(costObj,qty); // valOf evals it if it's a function
    if (!isValid(costObj)) { return 0; }

    qty = Math.min(qty,canAfford(costObj));
    if (qty === 0) { return 0; }

    var i,num;
    for(i in costObj)
    {
        // If the cost is a function, eval it with qty as a param.  Otherwise
        // just multiply by qty.
        num = (typeof costObj[i] == "function") ? (costObj[i](qty)) : (costObj[i]*qty);
        if (!num) { continue; }
        civData[i].owned -= num;
    }

    return qty;
}

// Returns the number of the object that we could buy or sell, taking into
// account any applicable limits.
// purchaseObj - The object to purchase
// qty - Maximum number to buy/sell (use -Infinity for the max salable)
function canPurchase(purchaseObj,qty)
{
    if (!purchaseObj) { return 0; }
    if (qty === undefined) { qty = Infinity; } // Default to as many as we can.
    if (qty === false) { qty = -1; } // Selling back a boolean item.

    // Can't buy if we don't meet the prereqs.
    if (!meetsPrereqs(purchaseObj.prereqs)) { qty = Math.min(qty, 0); }

    // Can't sell more than we have (if salable at all)
    qty = Math.max(qty, -(purchaseObj.salable ? purchaseObj.owned : 0));
    
    // If this is a relocation, can't shift more than our source pool.
    if (purchaseObj.source) { qty = Math.min(qty, civData[purchaseObj.source].owned); }

    // If this is a destination item, it's just a relocation of an existing
    // item, so we ignore purchase limits.  Otherwise we check them.
    if (purchaseObj.isDest && !purchaseObj.isDest()) { qty = Math.min(qty, purchaseObj.limit - purchaseObj.total); }

    // See if we can afford them; return fewer if we can't afford them all
    return Math.min(qty,canAfford(purchaseObj.require));
}


// Interface initialization code

// Much of this interface consists of tables of buttons, columns of which get
// revealed or hidden based on toggles and population.  Currently, we do this
// by setting the "display" property on every affected <td>.  This is very
// inefficient, because it forces a table re-layout after every cell change.
//
// A better approach tried but ultimately abandoned was to use <col> elements
// to try to manipulate the columns wholesale.  Unfortunately, <col> is
// minimally useful, because only a few CSS properties are supported on <col>.
// Even though one of those, "visibility", purports to have the "collapse" 
// value for just this purpose, it doesn't work; brower support for this
// property is very inconsistent, particularly in the handling of cell borders.
//
// Eventually, I hope to implement dynamic CSS rules, so that I can restyle 
// lots of elements at once.

// Generate two HTML <span> texts to display an item's cost and effect note.
function getCostNote(civObj)
{
    // Only add a ":" if both items are present.
    var reqText = getReqText(civObj.require);
    var effectText = (isValid(civObj.effectText)) ? civObj.effectText : "";
    var separator = (reqText && effectText) ? ": " : "";

    return "<span id='"+civObj.id+"Cost' class='cost'>" + reqText + "</span>"
         + "<span id='"+civObj.id+"Note' class='note'>" + separator + civObj.effectText + "</span>";
}

// Number format utility functions.
// - Allows testing the sign of strings that might be prefixed with '-' (like "-custom")
// - Output format uses the proper HTML entities for minus sign and infinity.
// Note that the sign of boolean false is treated as -1, since it indicates a
//   decrease in quantity (from 1 to 0).
function sgnnum(x) { return (x > 0) ? 1 : (x < 0) ? -1 : 0; }
function sgnstr(x) { return (x.length === 0) ? 0 : (x[0] == "-") ? -1 : 1; }
function sgnbool(x) { return (x ? 1 : -1); }
function absstr(x) { return (x.length === 0) ? "" : (x[0] == "-") ? x.slice(1) : x; }
function sgn(x) { return (typeof x == "number") ? sgnnum(x) 
                       : (typeof x == "string") ? sgnstr(x) 
                       : (typeof x == "boolean") ? sgnbool(x) : 0; }
function abs(x) { return (typeof x == "number") ? Math.abs(x) : (typeof x == "string") ? absstr(x) : x; }


// Pass this the item definition object.
// Or pass nothing, to create a blank row.
function getResourceRowText(purchaseObj)
{
    // Make sure to update this if the number of columns changes.
    if (!purchaseObj) { return "<tr class='purchaseRow'><td colspan='6'/>&nbsp;</tr>"; }

    var objId = purchaseObj.id;
    var objName = purchaseObj.getQtyName(0);
    var s = "<tr id='"+objId+"Row' class='purchaseRow' data-target='"+objId+"'>";
 
    s += "<td><button data-action='increment'>"+purchaseObj.verb+" "+objName+"</button></td>";
    s += "<td class='itemname'>"+objName+": </td>";
    s += "<td class='number'><span data-action='display'>0</span></td>";
    s += "<td class='icon'><img src='images/"+objId+".png' class='icon icon-lg' alt='"+objName+"'/></td>";
    s += "<td class='number'>(Max: <span id='max"+objId+"'>200</span>)</td>";
    s += "<td class='number net'><span data-action='displayNet'>0</span>/s</td>";

    s += "</tr>";

    return s;
}


function getPurchaseCellText(purchaseObj, qty, inTable) {
    if (inTable === undefined) { inTable = true; }
    // Internal utility functions.
    function sgnchr(x) { return (x > 0) ? "+" : (x < 0) ? "&minus;" : ""; }
    //xxx Hack: Special formatting for booleans, Infinity and 1k.
    function infchr(x) { return (x == Infinity) ? "&infin;" : (x == 1000) ? "1k" : x; }
    function fmtbool(x) {
        var neg = (sgn(x) < 0);
        return (neg ? "(" : "") + purchaseObj.getQtyName(0) + (neg ? ")" : "");
    }
    function fmtqty(x) { return (typeof x == "boolean") ? fmtbool(x) : sgnchr(sgn(x))+infchr(abs(x)); }
    function allowPurchase() {
        if (!qty) { return false; } // No-op

        // Can't buy/sell items not controlled by player
        if (purchaseObj.alignment && (purchaseObj.alignment != "player")) { return false; }

        // Quantities > 1 are meaningless for boolean items.
        if ((typeof purchaseObj.initOwned == "boolean")&&(abs(qty) > 1)) { return false; }

        // Don't buy/sell unbuyable/unsalable items.
        if ((sgn(qty) > 0) && (purchaseObj.require === undefined)) { return false; }
        if ((sgn(qty) < 0) && (!purchaseObj.salable)) { return false; }

        //xxx Right now, variable-cost items can't be sold, and are bought one-at-a-time.
        if ((qty != 1) && purchaseObj.hasVariableCost()) { return false; }

        return true;
    }

    var tagName = inTable ? "td" : "span";
    var className = (abs(qty) == "custom") ? "buy" : purchaseObj.type;  // 'custom' buttons all use the same class.

    var s = "<"+tagName+" class='"+className+abs(qty)+"' data-quantity='"+qty+"' >";
    if (allowPurchase()) 
    { 
        s +="<button class='x"+abs(qty)+"' data-action='purchase'"+" disabled='disabled'>"+fmtqty(qty)+"</button>"; 
    }
    s += "</"+tagName+">";
    return s;
}

// Pass this the item definition object.
// Or pass nothing, to create a blank row.
function getPurchaseRowText(purchaseObj)
{
    // Make sure to update this if the number of columns changes.
    if (!purchaseObj) { return "<tr class='purchaseRow'><td colspan='13'/>&nbsp;</tr>"; }

    var objId = purchaseObj.id;
    var s = "<tr id='"+objId+"Row' class='purchaseRow' data-target='"+purchaseObj.id+"'>";
 
    [-Infinity, "-custom", -100, -10, -1]
    .forEach(function(elem) { s += getPurchaseCellText(purchaseObj, elem); });

    var enemyFlag = (purchaseObj.alignment == "enemy") ? " enemy" : "";
    s += "<td class='itemname"+enemyFlag+"'>"+purchaseObj.getQtyName(0)+": </td>";

    var action = (isValid(population[objId])) ? "display_pop" : "display"; //xxx Hack
    s += "<td class='number'><span data-action='"+action+"'>0</span></td>";

    // Don't allow Infinite (max) purchase on things we can't sell back.
    [1, 10, 100, "custom", ((purchaseObj.salable) ? Infinity : 1000)]
    .forEach(function(elem) { s += getPurchaseCellText(purchaseObj, elem); });

    s += "<td>" + getCostNote(purchaseObj) + "</td>";
    s += "</tr>";

    return s;
}

// For efficiency, we set up a single bulk listener for all of the buttons, rather
// than putting a separate listener on each button.
function onBulkEvent(e)
{
    switch (dataset(e.target,"action")) 
    {
        case "increment": return onIncrement(e.target);
        case "purchase" : return onPurchase(e.target);
        case "raid"     : return onInvade(e.target);
    }
    return false;
}

function addUITable(civObjs, groupElemName)
{
    var s="";
    civObjs.forEach(function(elem) { s += elem.type == "resource" ? getResourceRowText(elem) 
                                        : elem.type == "upgrade"  ? getUpgradeRowText(elem) 
                                        : getPurchaseRowText(elem); });
    var groupElem = document.getElementById(groupElemName);
    groupElem.innerHTML += s;
    groupElem.onmousedown = onBulkEvent;
    return groupElem;
}

//xxx This should become an onGain() member method of the building classes
function updateRequirements(buildingObj){
    var displayNode = document.getElementById(buildingObj.id + "Cost");
    if (displayNode) { displayNode.innerHTML = getReqText(buildingObj.require); }
}

function updatePurchaseRow(purchaseObj){
    if (!purchaseObj) { return; }

    var elem = document.getElementById(purchaseObj.id + "Row");
    if (!elem) { console.log("Missing UI for "+purchaseObj.id); return; }

    // If the item's cost is variable, update its requirements.
    if (purchaseObj.hasVariableCost()) { updateRequirements(purchaseObj); }

    // Already having one reveals it as though we met the prereq.
    var havePrereqs = (purchaseObj.owned > 0) || meetsPrereqs(purchaseObj.prereqs);

    // Special check: Hide one-shot upgrades after purchase; they're
    // redisplayed elsewhere.
    var hideBoughtUpgrade = ((purchaseObj.type == "upgrade") && (purchaseObj.owned == purchaseObj.limit) && !purchaseObj.salable);

    // Reveal the row if  prereqs are met
    setElemDisplay(elem,havePrereqs && !hideBoughtUpgrade);

    var maxQty = canPurchase(purchaseObj);
    var minQty = canPurchase(purchaseObj,-Infinity);

    var buyElems=elem.querySelectorAll("[data-action='purchase']");
    var i, purchaseQty,absQty,curElem;
    for (i=0;i<buyElems.length;++i)
    {
        curElem = buyElems[i];
        purchaseQty = dataset(curElem,"quantity");
        // Treat 'custom' or Infinity as +/-1.
        //xxx Should we treat 'custom' as its appropriate value instead?
        absQty = abs(purchaseQty);
        if ((absQty == "custom") || (absQty == Infinity)) { purchaseQty = sgn(purchaseQty); }

        curElem.disabled = ((purchaseQty > maxQty) || (purchaseQty < minQty));
    }
}


// Only set up for the basic resources right now.
function updateResourceRows() { basicResources.forEach(function(elem) { updatePurchaseRow(elem); }); }
// Enables/disabled building buttons - calls each type of building in turn
// Can't do altars; they're not in the proper format.
function updateBuildingButtons() { homeBuildings.forEach(function(elem) { updatePurchaseRow(elem); }); }
// Update the page with the latest worker distribution and stats
function updateJobButtons(){ homeUnits.forEach(function(elem) { updatePurchaseRow(elem); }); }
// Updates the party (and enemies)
function updatePartyButtons(){ armyUnits.forEach(function(elem) { updatePurchaseRow(elem); }); }


// We have a separate row generation function for upgrades, because their
// layout is differs greatly from buildings/units:
//  - Upgrades are boolean, so they don't need multi-purchase buttons.
//  - Upgrades don't need quantity labels, and put the name in the button.
//  - Upgrades are sometimes generated in a table with <tr>, but sometimes
//    outside of one with <span>.
function getUpgradeRowText(upgradeObj, inTable)
{
    if (inTable === undefined) { inTable = true; }
    var cellTagName = inTable ? "td" : "span";
    var rowTagName = inTable ? "tr" : "span";
    // Make sure to update this if the number of columns changes.
    if (!upgradeObj) { return inTable ? "<"+rowTagName+" class='purchaseRow'><td colspan='2'/>&nbsp;</"+rowTagName+">" : ""; }

    var s=  "<"+rowTagName+" id='"+upgradeObj.id+"Row' class='purchaseRow'";
    s +=    " data-target='"+upgradeObj.id+"'>";
    s +=    getPurchaseCellText(upgradeObj, true, inTable);
    s +=    "<"+cellTagName+">" + getCostNote(upgradeObj) + "</"+cellTagName+">";
    if (!inTable) { s += "<br />"; }
    s +=    "</"+rowTagName+">";
    return s;
}
function getPantheonUpgradeRowText(upgradeObj)
{
    if (!upgradeObj) { return ""; }

    var s = "<tr id='"+upgradeObj.id+"Row' class='purchaseRow'>";
    // Don't include devotion if it isn't valid.
    //xxx Should write a chained dereference eval
    s += "<td class='devcost'>";
    s +=     ((isValid(upgradeObj.prereqs) && isValid(upgradeObj.prereqs.devotion)) 
            ? (upgradeObj.prereqs.devotion +"d&nbsp;") : "") +"</td>";
    //xxx The 'fooRow' id is added to make altars work, but should be redesigned.
    s += "<td class='"+upgradeObj.type+"true'><button id='"+upgradeObj.id+"' class='xtrue'";
    s += " data-action='purchase' data-quantity='true' data-target="+upgradeObj.id;
    s += " disabled='disabled' onmousedown=\"";
    // The event handler can take three forms, depending on whether this is
    // an altar, a prayer, or a pantheon upgrade.
    s += ((upgradeObj.subType == "prayer") ? (upgradeObj.id+"()")
                                           : ("onPurchase(this)"));
    s += "\">" + upgradeObj.getQtyName() + "</button>";
    s += (isValid(upgradeObj.extraText) ? upgradeObj.extraText : "")+"</td>";
    s += "<td>" + getCostNote(upgradeObj) + "</td>";
    s += "</tr>";

    return s;
}
// Returns the new element
function setPantheonUpgradeRowText(upgradeObj)
{
    if (!upgradeObj) { return null; }
    var elem = document.getElementById(upgradeObj.id+"Row");
    if (!elem) { return null; }

    elem.outerHTML = getPantheonUpgradeRowText(upgradeObj); // Replaces elem
    return document.getElementById(upgradeObj.id+"Row"); // Return replaced element
}
// Dynamically create the upgrade purchase buttons.
function addUpgradeRows()
{
    document.getElementById("upgradesPane").innerHTML += 
       "<h3>Purchased Upgrades</h3>" + "<div id='purchasedUpgrades'></div>";

    // Fill in any pre-existing stubs.
    upgradeData.forEach( function(elem){ 
        if (elem.subType == "upgrade") { return; } // Did these above.
        if (elem.subType == "pantheon") { setPantheonUpgradeRowText(elem); }
        else { // One of the 'atypical' upgrades not displayed in the main upgrade list.
            var stubElem = document.getElementById(elem.id+"Row");
            if (!stubElem) { console.log("Missing UI element for "+elem.id); return; }
            stubElem.outerHTML = getUpgradeRowText(elem, false); // Replaces stubElem
            stubElem = document.getElementById(elem.id+"Row"); // Get stubElem again.
            stubElem.onmousedown=onBulkEvent;
        }
    });

    // Altars
    buildingData.forEach(function(elem) { if (elem.subType == "altar") { setPantheonUpgradeRowText(elem); } });

    // Deity granted powers
    powerData.forEach(function(elem) { if (elem.subType == "prayer") { setPantheonUpgradeRowText(elem); } });

    // Dynamically create two lists for purchased upgrades.
    // One for regular upgrades, one for pantheon upgrades.
    var text="", standardUpgStr="", pantheonUpgStr="";

    upgradeData.forEach( function(upgradeObj){ 
        text = "<span id='P"+upgradeObj.id +"' class='Pupgrade'>"
            +"<strong>"+upgradeObj.getQtyName()+"</strong>"
            +" &ndash; "+upgradeObj.effectText+"<br/></span>";
        if (upgradeObj.subType == "pantheon") { pantheonUpgStr += text; }
        else { standardUpgStr += text; }
    });

    document.getElementById("purchasedUpgrades").innerHTML += standardUpgStr;
    document.getElementById("purchasedPantheon").innerHTML = pantheonUpgStr;
}


// Update functions. Called by other routines in order to update the interface.

//xxx Maybe add a function here to look in various locations for vars, so it
//doesn't need multiple action types?
function updateResourceTotals(){
    var i,displayElems,elem,val;

    // Scan the HTML document for elements with a "data-action" element of
    // "display".  The "data-target" of such elements (or their ancestors) 
    // is presumed to contain
    // the global variable name to be displayed as the element's content.
    //xxx Note that this is now also updating nearly all updatable values,
    // including population.
    displayElems=document.querySelectorAll("[data-action='display']");
    for (i=0;i<displayElems.length;++i)
    {
        elem = displayElems[i];
        //xxx Have to use curCiv here because of zombies and other non-civData displays.
        elem.innerHTML = prettify(Math.floor(curCiv[dataset(elem,"target")].owned));
    }

    // Update net production values for primary resources.  Same as the above,
    // but look for "data-action" == "displayNet".
    displayElems=document.querySelectorAll("[data-action='displayNet']");
    for (i=0;i<displayElems.length;++i)
    {
        elem = displayElems[i];
        val = civData[dataset(elem,"target")].net;
        if (!isValid(val)) { continue; }

        // Colourise net production values.
        if      (val < 0) { elem.style.color="#f00"; }
        else if (val > 0) { elem.style.color="#0b0"; }
        else              { elem.style.color="#000"; }

        elem.innerHTML = prettify(val.toFixed(1));
    }

    if (civData.gold.owned >= 1){
        setElemDisplay("goldRow",true);
    }

    //Update page with building numbers, also stockpile limits.
    document.getElementById("maxfood").innerHTML = prettify(civData.food.limit);
    document.getElementById("maxwood").innerHTML = prettify(civData.wood.limit);
    document.getElementById("maxstone").innerHTML = prettify(civData.stone.limit);

    //Update land values
    var buildingCount = 0, landCount = 0;
    buildingData.forEach(function(elem) { 
        if (elem.subType == "land") { landCount     += elem.owned; }
        else                        { buildingCount += elem.owned; }
    });
    document.getElementById("totalBuildings").innerHTML = prettify(buildingCount);
    document.getElementById("totalLand"     ).innerHTML = prettify(buildingCount + landCount);

    // Unlock advanced control tabs as they become enabled (they never disable)
    // Temples unlock Deity, barracks unlock Conquest, having gold unlocks Trade.
    // Deity is also unlocked if there are any prior deities present.
    if ((civData.temple.owned > 0)||(curCiv.deities.length > 1)) { setElemDisplay("deitySelect",true); }
    if (civData.barracks.owned > 0) { setElemDisplay("conquestSelect",true); }
    if (civData.gold.owned > 0) { setElemDisplay("tradeSelect",true); }

    // Need to have enough resources to trade
    document.getElementById("trader").disabled = !curCiv.trader || !curCiv.trader.timer ||
        (civData[curCiv.trader.materialId].owned < curCiv.trader.requested);

    // Cheaters don't get names.
    document.getElementById("renameRuler").disabled = (curCiv.rulerName == "Cheater");

    updatePopulation(); //updatePopulation() handles the population limit, which is determined by buildings.
    updatePopulationUI(); //xxx Maybe remove this?
}

function updatePopulation(){
    //Update population limit by multiplying out housing numbers
    population.limit = civData.tent.owned + (civData.hut.owned * 3) + (civData.cottage.owned * 6) + (civData.house.owned * (10 + ((civData.tenements.owned) * 2) + ((civData.slums.owned) * 2))) + (civData.mansion.owned * 50);

    //Update sick workers
    population.totalSick = 0;
    unitData.forEach(function(elem) { if (elem.alignment == "player") { population.totalSick += (elem.ill||0); } });
    setElemDisplay("totalSickRow",(population.totalSick > 0));

    //Calculate healthy workers (excludes sick, zombies and deployed units)
    //xxx Should this use 'killable'?
    population.healthy = 0;
    unitData.forEach(function(elem) { if ((elem.vulnerable)) { population.healthy += elem.owned; } });
    //xxx Doesn't subtracting the zombies here throw off the calculations in randomHealthyWorker()?
    population.healthy -= curCiv.zombie.owned;

    //Calculate housed/fed population (excludes zombies)
    population.current = population.healthy + population.totalSick;
    unitData.forEach(function(elem) { if ((elem.alignment == "player")&&(elem.subType == "normal")&&(elem.place == "party")) 
    { population.current += elem.owned; } });

    //Zombie soldiers dying can drive population.current negative if they are killed and zombies are the only thing left.
    //xxx This seems like a hack that should be given a real fix.
    if (population.current < 0){
        if (curCiv.zombie.owned > 0){
            //This fixes that by removing zombies and setting to zero.
            curCiv.zombie.owned += population.current;
            population.current = 0;
        } else {
            console.log("Warning: Negative current population detected.");
        }
    }
}

//Update page with numbers
function updatePopulationUI() {
    var i, elem, elems, displayElems;

    // Scan the HTML document for elements with a "data-action" element of
    // "display_pop".  The "data-target" of such elements is presumed to contain
    // the population subproperty to be displayed as the element's content.
    //xxx This selector should probably require data-target too.
    //xxx Note that relatively few values are still stored in the population
    // struct; most of them are now updated by the 'display' action run
    // by updateResourceTotals().
    displayElems=document.querySelectorAll("[data-action='display_pop']");
    for (i=0;i<displayElems.length;++i)
    {
        elem = displayElems[i];
        elem.innerHTML = prettify(Math.floor(population[dataset(elem,"target")]));
    }

    civData.house.update(); //xxx Effect might change dynamically.  Need a more general way to do this.

    setElemDisplay("graveTotal",(curCiv.grave.owned > 0));

    //As population increases, various things change
    // Update our civ type name
    var civType = civSizes.getCivSize(population.current).name;
    if (population.current === 0 && population.limit >= 1000){
        civType = "Ghost Town";
    }
    if (curCiv.zombie.owned >= 1000 && curCiv.zombie.owned >= 2 * population.current){ //easter egg
        civType = "Necropolis";
    }
    document.getElementById("civType").innerHTML = civType;

    //Unlocking interface elements as population increases to reduce unnecessary clicking
    //xxx These should be reset in reset()
    if (population.current + curCiv.zombie.owned >= 10) {
        if (!settings.customIncr){    
            elems = document.getElementsByClassName("unit10");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
        }
    }
    if (population.current + curCiv.zombie.owned >= 100) {
        if (!settings.customIncr){
            elems = document.getElementsByClassName("building10");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
            elems = document.getElementsByClassName("unit100");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
        }
    }
    if (population.current + curCiv.zombie.owned >= 1000) {
        if (!settings.customIncr){
            elems = document.getElementsByClassName("building100");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
            elems = document.getElementsByClassName("unit1000");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
            elems = document.getElementsByClassName("unitInfinity");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
        }
    }
    if (population.current + curCiv.zombie.owned >= 10000) {
        if (!settings.customIncr){
            elems = document.getElementsByClassName("building1000");
            for(i = 0; i < elems.length; i++) {
                setElemDisplay(elems[i],!settings.customincr);
            }
        }
    }

    //Turning on/off buttons based on free space.
    var maxSpawn = Math.max(0,Math.min((population.limit - population.current),logSearchFn(calcWorkerCost,civData.food.owned)));

    document.getElementById("spawn1button").disabled = (maxSpawn < 1);
    document.getElementById("spawnCustomButton").disabled = (maxSpawn < 1);
    document.getElementById("spawnMaxbutton").disabled = (maxSpawn < 1);
    document.getElementById("spawn10button").disabled = (maxSpawn < 10);
    document.getElementById("spawn100button").disabled = (maxSpawn < 100);
    document.getElementById("spawn1000button").disabled = (maxSpawn < 1000);

    var canRaise = (getCurDeityDomain() == "underworld" && civData.devotion.owned >= 20);
    var maxRaise = canRaise ? logSearchFn(calcZombieCost,civData.piety.owned) : 0;
    setElemDisplay("raiseDeadRow", canRaise);
    document.getElementById("raiseDead").disabled = (maxRaise < 1);
    document.getElementById("raiseDeadMax").disabled = (maxRaise < 1);
    document.getElementById("raiseDead100").disabled = (maxRaise < 100);

    //Calculates and displays the cost of buying workers at the current population.
    document.getElementById("raiseDeadCost").innerHTML = prettify(Math.round(calcZombieCost(1)));
    document.getElementById("workerCost").innerHTML = prettify(Math.round(calcWorkerCost(1)));
    document.getElementById("workerCost10").innerHTML = prettify(Math.round(calcWorkerCost(10)));
    document.getElementById("workerCost100").innerHTML = prettify(Math.round(calcWorkerCost(100)));
    document.getElementById("workerCost1000").innerHTML = prettify(Math.round(calcWorkerCost(1000)));
    document.getElementById("workerNumMax").innerHTML = prettify(Math.round(maxSpawn));
    document.getElementById("workerCostMax").innerHTML = prettify(Math.round(calcWorkerCost(maxSpawn)));
    updateJobButtons(); //handles the display of units in the player's kingdom.
    updatePartyButtons(); // handles the display of units out on raids.
    updateMorale();
    updateAchievements(); //handles display of achievements
}


function typeToId(deityType) {
    if (deityType == "Battle")         { return "battle"; }
    if (deityType == "Cats")           { return "cats"; }
    if (deityType == "the Fields")     { return "fields"; }
    if (deityType == "the Underworld") { return "underworld"; }
    return deityType;
}
function idToType(domainId) {
    if (domainId == "battle")          { return "Battle"; }
    if (domainId == "cats")            { return "Cats"; }
    if (domainId == "fields")          { return "the Fields"; }
    if (domainId == "underworld")      { return "the Underworld"; }
    return domainId;
}


// Check to see if the player has an upgrade and hide as necessary
// Check also to see if the player can afford an upgrade and enable/disable as necessary
function updateUpgrades(){
    var deitySpecEnable;

    // Update all of the upgrades
    upgradeData.forEach( function(elem){ 
        updatePurchaseRow(elem);  // Update the purchase row.

        // Show the already-purchased line if we've already bought it.
        setElemDisplay(("P"+elem.id),elem.owned);
    });

    //deity techs
    document.getElementById("renameDeity").disabled = (!civData.worship.owned);
    setElemDisplay("deityDomains",((civData.worship.owned) && (getCurDeityDomain() === "")));
    setElemDisplay("battleUpgrades",(getCurDeityDomain() == "battle"));
    setElemDisplay("fieldsUpgrades",(getCurDeityDomain() == "fields"));
    setElemDisplay("underworldUpgrades",(getCurDeityDomain() == "underworld"));
    setElemDisplay("zombieWorkers", (curCiv.zombie.owned > 0));
    setElemDisplay("catsUpgrades",(getCurDeityDomain() == "cats"));

    deitySpecEnable = civData.worship.owned && (getCurDeityDomain() === "") && (civData.piety.owned >= 500);
    document.getElementById("battleDeity").disabled = !deitySpecEnable;
    document.getElementById("fieldsDeity").disabled = !deitySpecEnable;
    document.getElementById("underworldDeity").disabled = !deitySpecEnable;
    document.getElementById("catsDeity").disabled = !deitySpecEnable;

    //standard
    setElemDisplay("conquest",civData.standard.owned);

    // Trade
    setElemDisplay("tradeUpgradeContainer",civData.trade.owned);
}


function updateDeity(){
    //Update page with deity details
    document.getElementById("deityAName").innerHTML = curCiv.deities[0].name;
    document.getElementById("deityADomain").innerHTML = getCurDeityDomain() ? ", deity of "+idToType(getCurDeityDomain()) : "";
    document.getElementById("deityADevotion").innerHTML = civData.devotion.owned;

    // Display if we have an active deity, or any old ones.
    setElemDisplay("deityContainer",(curCiv.deities[0].name));
    setElemDisplay("activeDeity",(curCiv.deities[0].name));
    setElemDisplay("oldDeities",(curCiv.deities[0].name || curCiv.deities.length > 1));
    setElemDisplay("iconoclasmGroup",(curCiv.deities.length > 1));
}

function getDeityRowText(deityId, deityObj)
{
    if (!deityObj) { deityObj = { name:"No deity", domain:"", maxDev:0 }; }

    return "<tr id='"+deityId+"'>"
    + "<td><strong><span id='"+deityId+"Name'>"+deityObj.name+"</span></strong>"
    + "<span id="+deityId+"Domain' class='deityDomain'>"+"</td><td>"+idToType(deityObj.domain)+"</span></td>"
    + "<td><span id='" + deityId + "Devotion'>"+deityObj.maxDev+"</span></td></tr>";
}

function makeDeitiesTables()
{
    // Display the active deity
    var deityId = "deityA";
    document.getElementById("activeDeity").innerHTML = '<tr id="' + deityId + '">'
    + '<td><strong><span id="' + deityId + 'Name">'+'</span></strong>'
    + '<span id="' + deityId + 'Domain" class="deityDomain">' + '</span></td>'
    + '<td>Devotion: <span id="' + deityId + 'Devotion">'+'</span></td></tr>';

    // Display the table of prior deities.
    //xxx Change this to <th>, need to realign left.
    var s = "<tr><td><b>Name</b></td><td><b>Domain</b></td><td><b>Max Devotion</b></td></tr>";
    curCiv.deities.forEach(function(elem, i) {
        if ((i===0)&&(!elem.name)) { return; } // Don't display current deity-in-waiting.
        s += getDeityRowText("deity"+i,elem);
    });
    document.getElementById("oldDeities").innerHTML = s;

    updateDeity();
}

// Enables or disables availability of activated religious powers.
// Passive religious benefits are handled by the upgrade system.
function updateDevotion(){
    document.getElementById("deityA"+"Devotion").innerHTML = civData.devotion.owned;

    // Process altars
    buildingData.forEach(function(elem) { if (elem.subType == "altar") {
        setElemDisplay((elem.id+"Row"), meetsPrereqs(elem.prereqs));
        document.getElementById(elem.id).disabled = (!(meetsPrereqs(elem.prereqs) && canAfford(elem.require)));
    }});

    // Process activated powers
    powerData.forEach(function(elem) { if (elem.subType == "prayer") {
        //xxx raiseDead buttons updated by UpdatePopulationUI
        if (elem.id == "raiseDead") { return; }
        setElemDisplay((elem.id+"Row"), meetsPrereqs(elem.prereqs));
        document.getElementById(elem.id).disabled = !(meetsPrereqs(elem.prereqs) && canAfford(elem.require));
    }});

    //xxx Smite should also be disabled if there are no foes.

    //xxx These costs are not yet handled by canAfford().
    if (population.healthy < 1) { 
        document.getElementById("wickerman").disabled = true; 
        document.getElementById("walk").disabled = true; 
    }

    document.getElementById("ceaseWalk").disabled = (civData.walk.rate === 0);
}


// achObj can be:
//   true:  Generate a line break
//   false: Generate a gap
//   An achievement (or civ size) object: Generate the display of that achievement
function getAchRowText(achObj)
{
    if (achObj===true)  { return "<div style='clear:both;'><br /></div>"; }
    if (achObj===false) { return "<div class='break'>&nbsp;</div>"; }
    return "<div class='achievement' title='"+achObj.getQtyName()+"'>"+
            "<div class='unlockedAch' id='"+achObj.id+"'>"+achObj.getQtyName()+"</div></div>";
}

// Dynamically create the achievement display
function addAchievementRows()
{
    var s="";
    achData.forEach(function(elem) { s += getAchRowText(elem); });
    document.getElementById("achievements").innerHTML += s;
}

//Displays achievements if they are unlocked
function updateAchievements(){
    achData.forEach(function(achObj) { 
        setElemDisplay(achObj.id,achObj.owned);
    });
}

function testAchievements(){
    achData.forEach(function(achObj) { 
        if (civData[achObj.id].owned) { return true; }
        if (isValid(achObj.test) && !achObj.test()) { return false; }
        civData[achObj.id].owned = true;
        gameLog("Achievement Unlocked: "+achObj.getQtyName());
        return true;
    });

    updateAchievements();
}


// Dynamically add the raid buttons for the various civ sizes.
function addRaidRows()
{
    var s="";
    civSizes.forEach(function(elem) { 
        s += "<button class='raid' data-action='raid' data-target='"+elem.id+"' disabled='disabled'>"+
        "Raid "+elem.name+"</button><br />"; //xxxL10N
    });

    var group = document.getElementById("raidGroup");
    group.innerHTML += s;
    group.onmousedown=onBulkEvent;
}

// Enable the raid buttons for eligible targets.
function updateTargets(){
    var i;
    var raidButtons = document.getElementsByClassName("raid");
    var haveArmy = false;

    setElemDisplay("victoryGroup", curCiv.raid.victory);

    // Raid buttons are only visible when not already raiding.
    if (setElemDisplay("raidGroup", !curCiv.raid.raiding))
    {
        if (getCombatants("party", "player").length > 0) { haveArmy = true; }

        var curElem;
        for(i=0;i<raidButtons.length;++i)
        {
            // Disable if we have no standard, no army, or they are too big a target.
            curElem = raidButtons[i];
            curElem.disabled = (!civData.standard.owned||!haveArmy || (civSizes[dataset(curElem,"target")].idx > civSizes[curCiv.raid.targetMax].idx));
        }
    }
}

function updateMorale(){
    //updates the morale stat
    var text, color;
    //first check there's someone to be happy or unhappy, not including zombies
    if (population.current < 1) { curCiv.morale.efficiency = 1.0; }

    if      (curCiv.morale.efficiency > 1.4) { text = "Blissful"; color = "#f0f"; }
    else if (curCiv.morale.efficiency > 1.2) { text = "Happy";    color = "#00f"; }
    else if (curCiv.morale.efficiency > 0.8) { text = "Content";  color = "#0b0"; } // Was "#0d0" if pop === 0
    else if (curCiv.morale.efficiency > 0.6) { text = "Unhappy";  color = "#880"; }
    else                              { text = "Angry";    color = "#f00"; }

    document.getElementById("morale").innerHTML = text;
    document.getElementById("morale").style.color = color;
}

function addWonderSelectText() {
    var wcElem = document.getElementById("wonderCompleted");
    if (!wcElem) { console.log("Error: No wonderCompleted element found."); return; }
    var s = wcElem.innerHTML;
    wonderResources.forEach(function(elem,i, wr) {
        s += "<button onmousedown='wonderSelect(\"" +elem.id+"\")'>"+elem.getQtyName(0)+"</button>";
        // Add newlines to group by threes (but no newline for the last one)
        if (!((i+1)%3) && (i != wr.length - 1)) { s += "<br />"; }
    });
    
    wcElem.innerHTML = s;
}

//updates the display of wonders and wonder building
function updateWonder() {
    var haveTech = (civData.architecture.owned && civData.civilservice.owned);

    // Display this section if we have any wonders or could build one.
    setElemDisplay("wondersContainer",(haveTech || curCiv.wonders.length > 0));

    // Can start building a wonder, but haven't yet.
    setElemDisplay("startWonderLine",(haveTech && curCiv.curWonder.stage === 0 ));
    document.getElementById("startWonder").disabled = (!haveTech || curCiv.curWonder.stage !== 0); 

    // Construction in progress; show/hide building area and labourers
    setElemDisplay("labourerRow",(curCiv.curWonder.stage === 1));
    setElemDisplay("wonderInProgress",(curCiv.curWonder.stage === 1));
    setElemDisplay("speedWonderGroup",(curCiv.curWonder.stage === 1));
    document.getElementById("speedWonder").disabled = (curCiv.curWonder.stage !== 1 || !canAfford({ gold: 100 }));
    if (curCiv.curWonder.stage === 1){
        document.getElementById("progressBar").style.width = curCiv.curWonder.progress.toFixed(2) + "%";
        document.getElementById("progressNumber").innerHTML = curCiv.curWonder.progress.toFixed(2);
    }

    // Finished, but haven't picked the resource yet.
    setElemDisplay("wonderCompleted",(curCiv.curWonder.stage === 2));
 
    updateWonderList();
}

function updateWonderList(){
    if (curCiv.wonders.length === 0) { return; }

    var i;
    //update wonder list
    var wonderhtml = "<tr><td><strong>Name</strong></td><td><strong>Type</strong></td></tr>";
    for (i=(curCiv.wonders.length - 1); i >= 0; --i){
        try {
            wonderhtml += "<tr><td>"+curCiv.wonders[i].name+"</td><td>"+curCiv.wonders[i].resourceId+"</td></tr>";
        } catch(err) {
            console.log("Could not build wonder row " + i);
        }
    }
    document.getElementById("pastWonders").innerHTML = wonderhtml;
}

function updateReset(){
    setElemDisplay("resetNote"  , (civData.worship.owned || curCiv.curWonder.stage === 3));
    setElemDisplay("resetDeity" , (civData.worship.owned));
    setElemDisplay("resetWonder", (curCiv.curWonder.stage === 3));
    setElemDisplay("resetBoth"  , (civData.worship.owned && curCiv.curWonder.stage === 3));
}

function updateSettings(){
    // Here, we ensure that UI is properly configured for our settings.
    // Calling these with no parameter makes them update the UI for the current values.
    setAutosave();
    setCustomQuantities();
    textSize(0);
    setDelimiters();
    setShadow();
    setNotes();
    setWorksafe();
    setIcons();
}

function update(){

    //unified update function. NOT YET IMPLEMENTED

    //debugging - mark beginning of function execution
    var start = new Date().getTime();

    //call each existing update subfunction in turn
    updateResourceTotals(); //need to remove call to updatePopulation, move references to upgrades
    updatePopulation(); //move enabling/disabling by space to updateJobButtons, remove calls to updateJobButtons, updateMorale, updateAchievements
    updatePopulationUI();
    updateResourceRows();
    updateBuildingButtons();
    updateJobButtons();
    updatePartyButtons();
    updateUpgrades();
    //updateDeity(); --- only needs to be called on initialisation and deity-related interactions ---
    //makeDeitiesTables(); --- only needs to be called on initialisation and deity-related interactions ---
    updateDevotion(); //need to add else clauses to disable buttons, change the way updates are revealed (unhidden as devotion increases)
    //updateRequirements(); --- only needs to be called on building-related interactions, though must subsequently call the update() function ---
    updateAchievements(); //should probably include else clauses
    //updateTargets();  --- only to be called at initialisation and targetMax alterations
    updateMorale();
    updateWonder(); //remove reference to updateWonderList
    //updateWonderList(); --- only to be called at initialisation and when wonders are created ---
    updateReset();
    
    //Debugging - mark end of function, calculate delta in milliseconds, and print to console
    var end = new Date().getTime();
    var time = end - start;
    //console.log("Update loop execution time: " + time + "ms"); //temporary altered to return time in order to run a debugging function
    return time;
}


// Game functions

//This function is called every time a player clicks on a primary resource button
function increment(objId){
    var purchaseObj = civData[objId];
    if (!purchaseObj) { console.log("Unknown purchase: "+objId); return; }

    var numArmy = 0;
    unitData.forEach(function(elem) { if ((elem.alignment == "player")&&(elem.species=="human")
                                        &&(elem.combatType)&&(elem.place == "home")) 
    { numArmy += elem.owned; } }); // Nationalism adds military units.

    purchaseObj.owned += purchaseObj.increment 
      + (purchaseObj.increment * 9 * (civData.civilservice.owned)) 
      + (purchaseObj.increment * 40 * (civData.feudalism.owned)) 
      + ((civData.serfs.owned) * Math.floor(Math.log(civData.unemployed.owned * 10 + 1))) 
      + ((civData.nationalism.owned) * Math.floor(Math.log(numArmy * 10 + 1)));

    //Handles random collection of special resources.
    var specialChance = purchaseObj.specialChance;
    if (specialChance && purchaseObj.specialMaterial && civData[purchaseObj.specialMaterial]) {
        if ((purchaseObj === civData.food) && (civData.flensing.owned))    { specialChance += 0.1; }
        if ((purchaseObj === civData.stone) && (civData.macerating.owned)) { specialChance += 0.1; }
        if (Math.random() < specialChance){
            var specialMaterial = civData[purchaseObj.specialMaterial];
            var specialQty =  purchaseObj.increment * (1 + (9 * (civData.guilds.owned)));
            specialMaterial.owned += specialQty;
            gameLog("Found " + specialMaterial.getQtyName(specialQty) + " while " + purchaseObj.activity); // I18N
        }
    }
    //Checks to see that resources are not exceeding their limits
    if (purchaseObj.owned > purchaseObj.limit) { purchaseObj.owned = purchaseObj.limit; }

    document.getElementById("clicks").innerHTML = prettify(Math.round(++curCiv.resourceClicks));
    updateResourceTotals(); //Update the page with totals
}
function onIncrement(control) { 
    // We need a valid target to complete this action.
    var targetId = dataset(control,"target");
    if (targetId === null) { return false; }

    return increment(targetId);
}

// Buys or sells a unit, building, or upgrade.
// Pass a positive number to buy, a negative number to sell.
// If it can't add/remove as many as requested, does as many as it can.
// Pass Infinity/-Infinity as the num to get the max possible.
// Pass "custom" or "-custom" to use the custom increment.
// Returns the actual number bought or sold (negative if fired).
function doPurchase(objId,num){
    var purchaseObj = civData[objId];
    if (!purchaseObj) { console.log("Unknown purchase: "+objId); return 0; }
    if (num === undefined) { num = 1; }
    if (abs(num) ==  "custom") { num =  sgn(num) * getCustomNumber(purchaseObj); }

    num = canPurchase(purchaseObj,num);  // How many can we actually get?

    // Pay for them
    num = payFor(purchaseObj.require,num);
    if (abs(num) < 1) { 
        gameLog("Could not build, insufficient resources."); // I18N
        return 0;
    }

    //Then increment the total number of that building
    // Do the actual purchase; coerce to the proper type if needed
    purchaseObj.owned = matchType(purchaseObj.owned + num,purchaseObj.initOwned);
    if (purchaseObj.source) { civData[purchaseObj.source].owned -= num; }

    // Post-purchase triggers
    if (isValid(purchaseObj.onGain)) { purchaseObj.onGain(num); } // Take effect

    //Increase devotion if the purchase provides it.
    if (isValid(purchaseObj.devotion)) { 
        civData.devotion.owned += purchaseObj.devotion * num; 
        // If we've exceeded this deity's prior max, raise it too.
        if (curCiv.deities[0].maxDev < civData.devotion.owned) {
            curCiv.deities[0].maxDev = civData.devotion.owned;
            makeDeitiesTables();
        }
    }

    //Then check for overcrowding
    if ((purchaseObj.type == "building") && --civData.freeLand.owned < 0){
        gameLog("You are suffering from overcrowding.");  // I18N
        adjustMorale(Math.max(num,-civData.freeLand.owned) * -0.0025 * (civData.codeoflaws.owned ? 0.5 : 1.0));
    }

    updateRequirements(purchaseObj); //Increases buildings' costs
    updateResourceTotals(); //Update page with lower resource values and higher building total
    updatePopulationUI(); //Updates the army display
    updateResourceRows(); //Update resource display
    updateBuildingButtons(); //Update the buttons themselves
    updateJobButtons(); //Update page with individual worker numbers, since limits might have changed.
    updatePartyButtons(); 
    updateUpgrades(); //Update which upgrades are available to the player
    updateDevotion(); //might be necessary if building was an altar
    updateTargets(); // might enable/disable raiding

    return num;
}

function onPurchase(control) { 
    // We need a valid target and a quantity to complete this action.
    var targetId = dataset(control,"target");
    if (targetId === null) { return false; }

    var qty = dataset(control,"quantity");
    if (qty === null) { return false; }

    return doPurchase(targetId, qty);
}


function getCustomNumber(civObj){
    if (!civObj||!civObj.customQtyId) { return undefined; }
    var elem = document.getElementById(civObj.customQtyId);
    if (!elem) { return undefined; }

    var num = Number(elem.value);

    // Check the above operations haven't returned NaN
    // Also don't allow negative increments.
    if (isNaN(num) || num < 0){
        elem.style.background = "#f99"; //notify user that the input failed
        return 0;
    } 

    num = Math.floor(num); // Round down

    elem.value = num; //reset fractional numbers, check nothing odd happened
    elem.style.background = "#fff";

    return num;
}


//Calculates and returns the cost of adding a certain number of workers at the present population
//xxx Make this work for negative numbers
function calcWorkerCost(num, curPop){
    if (curPop === undefined) { curPop = population.current; }
    return (20*num) + calcArithSum(0.01, curPop, curPop + num);
}
function calcZombieCost(num){ return calcWorkerCost(num, curCiv.zombie.owned)/5; }


// Create a cat
function spawnCat()
{
    ++civData.cat.owned;
    gameLog("Found a cat!");
}

// Creates or destroys workers
function spawn(num){
    var jobObj = civData.unemployed;
    if (num == "custom" ) { num =  getCustomNumber(jobObj); }
    if (num == "-custom") { num = -getCustomNumber(jobObj); }

    // Find the most workers we can spawn
    num = Math.max(num, -jobObj.owned);  // Cap firing by # in that job.
    num = Math.min(num,logSearchFn(calcWorkerCost,civData.food.owned));

    // Apply population limit, and only allow whole workers.
    num = Math.min(num, (population.limit - population.current));

    // Update numbers and resource levels
    civData.food.owned -= calcWorkerCost(num);

    // New workers enter as farmers, but we only destroy idle ones.
    if (num >= 0) { civData.farmer.owned += num; }
    else          { jobObj.owned += num; }
    updatePopulation(); //Run through the population->job update cycle

    //This is intentionally independent of the number of workers spawned
    if (Math.random() * 100 < 1 + (civData.lure.owned)) { spawnCat(); }

    updateResourceTotals(); //update with new resource number
    updatePopulationUI();
    
    return num;
}

// Picks the next worker to starve.  Kills the sick first, then the healthy.
// Deployed military starve last.
// Return the job ID of the selected target.
function pickStarveTarget() {
    var modNum,jobNum;
    var modList=["ill","owned"]; // The sick starve first
    //xxx Remove this hard-coded list.
    var jobList=["unemployed","blacksmith","tanner","miner","woodcutter",
        "cleric","cavalry","soldier","healer","labourer","farmer"];

    for (modNum=0;modNum<modList.length;++modNum)
    {
        for (jobNum=0;jobNum<jobList.length;++jobNum)
        {
            if (civData[jobList[jobNum]][modList[modNum]] > 0) 
                { return civData[jobList[jobNum]]; }
        }
    }
    // These don't have Ill variants at the moment.
    if (civData.cavalryParty.owned > 0) { return civData.cavalryParty; }
    if (civData.soldierParty.owned > 0) { return civData.soldierParty; }

    return null;
}

// Culls workers when they starve.
function starve(num) {
    var targetObj,i;
    if (num === undefined) { num = 1; }
    num = Math.min(num,population.current);

    for (i=0;i<num;++i)
    {
        targetObj = pickStarveTarget();
        if (!targetObj) { return i; }

        if (targetObj.ill) { --targetObj.ill; }
        else               { --targetObj.owned; }
        updatePopulation();

        ++civData.corpses.owned; //Increments corpse number
        //Workers dying may trigger Book of the Dead
        if (civData.book.owned) { civData.piety.owned += 10; }
    }

    return num;
}

function doStarve() {
    var corpsesEaten, num_starve;
    if (civData.food.owned < 0 && civData.waste.owned) // Workers eat corpses if needed
    {
        corpsesEaten = Math.min(civData.corpses.owned,-civData.food.owned);
        civData.corpses.owned -= corpsesEaten;
        civData.food.owned += corpsesEaten;
    }

    if (civData.food.owned < 0) { // starve if there's not enough food.
        //xxx This is very kind.  Only 0.1% deaths no matter how big the shortage?
        num_starve = starve(Math.ceil(population.current/1000));
        if (num_starve == 1) { gameLog("A worker starved to death"); }
        if (num_starve > 1) { gameLog(prettify(num_starve) + " workers starved to death"); }
        adjustMorale(-0.01);
        civData.food.owned = 0;
    }
}


// Creates or destroys zombies
// Pass a positive number to create, a negative number to destroy.
// Only idle zombies can be destroyed.
// If it can't create/destroy as many as requested, does as many as it can.
// Pass Infinity/-Infinity as the num to get the max possible.
// Pass "custom" or "-custom" to use the custom increment.
// Returns the actual number created or destroyed (negative if destroyed).
function raiseDead(num){
    if (num === undefined) { num = 1; }
    if (num == "custom") { num = getCustomNumber(civData.unemployed); }
    if (num == "-custom") { num = -getCustomNumber(civData.unemployed); }

    // Find the most zombies we can raise
    num = Math.min(num, civData.corpses.owned);
    num = Math.max(num, -curCiv.zombie.owned);  // Cap firing by # in that job.
    num = Math.min(num,logSearchFn(calcZombieCost,civData.piety.owned));

    //Update numbers and resource levels
    civData.piety.owned -= calcZombieCost(num);
    curCiv.zombie.owned += num;
    civData.unemployed.owned += num;
    civData.corpses.owned -= num;

    //Notify player
    if      (num ==  1) { gameLog("A corpse rises, eager to do your bidding."); } 
    else if (num  >  1) { gameLog("The corpses rise, eager to do your bidding."); }
    else if (num == -1) { gameLog("A zombie crumples to the ground, inanimate."); }
    else if (num  < -1) { gameLog("The zombies fall, mere corpses once again."); }

    updatePopulation(); //Run through population->jobs cycle to update page with zombie and corpse totals
    updatePopulationUI();
    updateResourceTotals(); //Update any piety spent

    return num;
}

function summonShade(){
    if (curCiv.enemySlain.owned <= 0) { return 0; }
    if (!payFor(civData.summonShade.require)) { return 0; }

    var num = Math.ceil(curCiv.enemySlain.owned/4 + (Math.random() * curCiv.enemySlain.owned/4));
    curCiv.enemySlain.owned -= num;
    civData.shade.owned += num;

    return num;
}

//Deity Domains upgrades
function selectDeity(domain,force){
    if (!force) {
        if (civData.piety.owned < 500) { return; } // Can't pay
        civData.piety.owned -= 500;
    }
    curCiv.deities[0].domain = domain;

    document.getElementById(domain+"Upgrades").style.display = "inline";
    document.getElementById("deityDomains").style.display = "none";
    makeDeitiesTables();
}

function digGraves(num){
    //Creates new unfilled graves.
    curCiv.grave.owned += 100 * num;
    updatePopulationUI(); //Update page with grave numbers
}

//Selects a random healthy worker based on their proportions in the current job distribution.
//xxx Doesn't currently pick from the army
//xxx Take a parameter for how many people to pick.
//xxx Make this able to return multiples by returning a cost structure.
function randomHealthyWorker(){
    var num = Math.random() * population.healthy;
    var chance = 0;
    var i;
    for (i=0;i<killable.length;++i)
    {
        chance += civData[killable[i].id].owned;
        if (chance > num) { return killable[i].id; }
    }

    return "";
}

//Selects a random worker, kills them, and then adds a random resource
//xxx This should probably scale based on population (and maybe devotion).
function wickerman(){
    //Select a random worker
    var job = randomHealthyWorker();
    if (!job) { return; }

    //Pay the price
    if (!payFor(civData.wickerman.require)) { return; }
    --civData[job].owned;
    updatePopulation(); //Removes killed worker

    //Select a random lootable resource
    var rewardObj = lootable[Math.floor(Math.random() * lootable.length)];

    var qty = Math.floor(Math.random() * 1000);
    //xxx Note that this presumes the price is 500 wood.
    if (rewardObj.id == "wood") { qty = (qty/2) + 500; } // Guaranteed to at least restore initial cost.
    rewardObj.owned += qty;

    function getRewardMessage(rewardObj) { switch(rewardObj.id) {
        case "food"   :  return "The crops are abundant!";
        case "wood"   :  return "The trees grow stout!";
        case "stone"  :  return "The stone splits easily!";
        case "skins"  :  return "The animals are healthy!";
        case "herbs"  :  return "The gardens flourish!"; 
        case "ore"    :  return "A new vein is struck!"; 
        case "leather":  return "The tanneries are productive!"; 
        case "metal"  :  return "The steel runs pure."; 
        default       :  return "You gain " + rewardObj.getQtyName(qty) + "!"; 
    } }

    gameLog("Burned a " + civData[job].getQtyName(1) + ". " + getRewardMessage(rewardObj));
    updateResourceTotals(); //Adds new resources
    updatePopulationUI();
}

function walk(increment){
    if (increment === undefined) { increment = 1; }
    if (increment === false) { increment = 0; civData.walk.rate = 0; }

    civData.walk.rate += increment;

    //xxx This needs to move into the main loop in case it's reloaded.
    document.getElementById("walkStat").innerHTML = prettify(civData.walk.rate);
    document.getElementById("ceaseWalk").disabled = (civData.walk.rate === 0);
    setElemDisplay("walkGroup",(civData.walk.rate > 0)); 
}

function tickWalk() {
    var i;
    var target = "";
    if (civData.walk.rate > population.healthy) { 
        civData.walk.rate = population.healthy; 
        document.getElementById("ceaseWalk").disabled = true;
    }
    if (civData.walk.rate <= 0) { return; }

    for (i=0;i<civData.walk.rate;++i){
        target = randomHealthyWorker(); //xxx Need to modify this to do them all at once.
        if (!target){ break; } 
        --civData[target].owned;
        // We don't want to do UpdatePopulation() in a loop, so we just do the
        // relevent adjustments directly.
        --population.current;
        --population.healthy;
    }
    updatePopulation();
    updatePopulationUI();
}

// Give a temporary bonus based on the number of cats owned.
function pestControl(length){
    if (length === undefined) { length = 10; }
    if (civData.piety.owned < (10 * length)) { return; }
    civData.piety.owned -= (10 * length);
    civData.pestControl.timer = length * civData.cat.owned;
    gameLog("The vermin are exterminated.");
}


/* Iconoclasm */

function iconoclasmList(){
    var i;
    //Lists the deities for removing
    if (civData.piety.owned >= 1000){
        civData.piety.owned -= 1000;
        updateResourceTotals();
        document.getElementById("iconoclasm").disabled = true;
        var append = "<br />";
        for (i=1;i<curCiv.deities.length;++i){
            append += '<button onclick="iconoclasm(' + i + ')">';
            append += curCiv.deities[i].name;
            append += '</button><br />';
        }
        append += '<br /><button onclick=\'iconoclasm("cancel")\'>Cancel</button>';
        document.getElementById("iconoclasmList").innerHTML = append;
    }
}

function iconoclasm(index){
    //will splice a deity from the deities array unless the user has cancelled
    document.getElementById("iconoclasmList").innerHTML = "";
    document.getElementById("iconoclasm").disabled = false;
    if ((index == "cancel")||(index >= curCiv.deities.length)){
        //return the piety
        civData.piety.owned += 1000;
        return;
    } 

    //give gold
    civData.gold.owned += Math.floor(Math.pow(curCiv.deities[index].maxDev,1/1.25));

    //remove the deity
    curCiv.deities.splice(index,1);

    makeDeitiesTables();
}

/* Enemies */

function spawnMob(mobObj, num){
    var num_sge = 0, msg = "";
 
    if (num === undefined) { // By default, base numbers on current population
        var max_mob = ((population.current + curCiv.zombie.owned) / 50);
        num = Math.ceil(max_mob*Math.random());
    }

    if (num === 0) { return num; }  // Nobody came

    // Human mobs might bring siege engines.
    if (mobObj.species == "human") { num_sge = Math.floor(Math.random() * num/100); }

    mobObj.owned += num;
    civData.esiege.owned += num_sge;

    msg = prettify(num) + " " + mobObj.getQtyName(num) + " attacked";  //xxx L10N
    if (num_sge > 0) { msg += ", with " + prettify(num_sge) + " " + civData.esiege.getQtyName(num_sge); }  //xxx L10N 
    gameLog(msg);

    return num;
}

function smiteMob(mobObj) {
    if (!isValid(mobObj.owned) || mobObj.owned <= 0) { return 0; }
    var num = Math.min(mobObj.owned,Math.floor(civData.piety.owned/100));
    civData.piety.owned -= num * 100;
    mobObj.owned -= num;
    civData.corpses.owned += num; //xxx Should dead wolves count as corpses?
    curCiv.enemySlain.owned += num;
    if (civData.throne.owned) { civData.throne.count += num; }
    if (civData.book.owned) { civData.piety.owned += num * 10; }
    gameLog("Struck down " + num + " " + mobObj.getQtyName(num)); // L10N
    return num;
}

function smite(){
    smiteMob(civData.barbarian);
    smiteMob(civData.bandit);
    smiteMob(civData.wolf);
    updateResourceTotals();
    updateJobButtons();
}

/* War Functions */

function invade(ecivtype){
    //invades a certain type of civilisation based on the button clicked
    curCiv.raid.raiding = true;
    curCiv.raid.last = ecivtype;

    curCiv.raid.epop = civSizes[ecivtype].max_pop + 1;
    // If no max pop, use 2x min pop.
    if (curCiv.raid.epop === Infinity ) { curCiv.raid.epop = civSizes[ecivtype].min_pop * 2; }
    if (civData.glory.timer > 0) { curCiv.raid.epop *= 2; } //doubles soldiers fought

    // 5-25% of enemy population is soldiers.
    civData.esoldier.owned += (curCiv.raid.epop/20) + Math.floor(Math.random() * (curCiv.raid.epop/5));
    civData.efort.owned += Math.floor(Math.random() * (curCiv.raid.epop/5000));

    // Glory redoubles rewards (doubled here because doubled already above)
    var baseLoot = curCiv.raid.epop / (1 + (civData.glory.timer <= 0));

    // Set rewards of land and other random plunder.
    //xxx Maybe these should be partially proportionate to the actual number of defenders?
    curCiv.raid.plunderLoot = { freeLand: Math.round(baseLoot * (1 + (civData.administration.owned))) };
    lootable.forEach(function(elem){ curCiv.raid.plunderLoot[elem.id] = Math.round(baseLoot * Math.random()); });

    updateTargets(); //Hides raid buttons until the raid is finished
    updatePartyButtons(); 
}
function onInvade(control) { return invade(dataset(control,"target")); }

function plunder(){
    var plunderMsg = "";

    // If we fought our largest eligible foe, but not the largest possible, raise the limit.
    if ((curCiv.raid.targetMax != civSizes[civSizes.length-1].id) && curCiv.raid.last == curCiv.raid.targetMax)
    {
        curCiv.raid.targetMax = civSizes[civSizes[curCiv.raid.targetMax].idx + 1].id;
    }

    // Improve morale based on size of defeated foe.
    adjustMorale((civSizes[curCiv.raid.last].idx + 1)/100);

    // Lamentation
    if (civData.lament.owned) { curCiv.attackCounter -= Math.ceil(curCiv.raid.epop/2000); }

    // Collect loot
    payFor(curCiv.raid.plunderLoot,-1);  // We pay for -1 of these to receive them.

    // Create message to notify player
    plunderMsg = civSizes[curCiv.raid.last].name + " defeated! ";
    plunderMsg += "Plundered " + getReqText(curCiv.raid.plunderLoot) + ". ";
    gameLog(plunderMsg); 

    // Victory outcome has been handled, end raid
    resetRaiding();
    updateResourceTotals();
    updateTargets();
}

function glory(time){
    if (time === undefined) { time = 180; }
    if (!payFor(civData.glory.require)) { return; } //check it can be bought

    civData.glory.timer = time; //set timer
    //xxx This needs to move into the main loop in case it's reloaded.
    document.getElementById("gloryTimer").innerHTML = civData.glory.timer; //update timer to player
    document.getElementById("gloryGroup").style.display = "block";
}

function grace(delta){
    if (delta === undefined) { delta = 0.1; }
    if (civData.piety.owned >= civData.grace.cost){
        civData.piety.owned -= civData.grace.cost;
        civData.grace.cost = Math.floor(civData.grace.cost * 1.2);
        document.getElementById("graceCost").innerHTML = prettify(civData.grace.cost);
        adjustMorale(delta);
        updateResourceTotals();
        updateMorale();
    }
}

//xxx Eventually, we should have events like deaths affect morale (scaled by %age of total pop)
function adjustMorale(delta){
    //Changes and updates morale given a delta value
    if (population.current + curCiv.zombie.owned > 0) { //dividing by zero is bad for hive
        //calculates zombie proportion (zombies do not become happy or sad)
        var fraction = population.current / (population.current + curCiv.zombie.owned);
        //alters morale
        curCiv.morale.efficiency += delta * fraction;
        //Then check limits (50 is median, limits are max 0 or 100, but moderated by fraction of zombies)
        if (curCiv.morale.efficiency > 1 + (0.5 * fraction)){
            curCiv.morale.efficiency = 1 + (0.5 * fraction);
        } else if (curCiv.morale.efficiency < 1 - (0.5 * fraction)){
            curCiv.morale.efficiency = 1 - (0.5 * fraction);
        }
        updateMorale(); //update to player
    }
}

/* Wonders functions */

function startWonder(){
    if (curCiv.curWonder.stage !== 0) { return; }
    ++curCiv.curWonder.stage;
    renameWonder();
    updateWonder();
}

function renameWonder(){
    // Can't rename before you start, or after you finish.
    if (curCiv.curWonder.stage === 0 || curCiv.curWonder.stage > 2) { return; }
    var n = prompt("Please name your Wonder:",curCiv.curWonder.name);
    if (!n) { return; }
    curCiv.curWonder.name = n;
    var wp = document.getElementById("wonderNameP");
    if (wp) { wp.innerHTML = curCiv.curWonder.name; }
    var wc = document.getElementById("wonderNameC");
    if (wc) { wc.innerHTML = curCiv.curWonder.name; }
}

function wonderSelect(resourceId){
    if (curCiv.curWonder.stage !== 2) { return; }
    ++curCiv.curWonder.stage;
    ++curCiv.curWonder[resourceId];
    gameLog("You now have a permanent bonus to " + resourceId + " production.");
    curCiv.wonders.push({name: curCiv.curWonder.name, resourceId: resourceId});
    curCiv.curWonder.name = "";
    curCiv.curWonder.progress = 0;
    updateWonder();
}


/* Trade functions */

function tradeTimer(){
    // Set timer length (10 sec + 5 sec/upgrade)
    curCiv.trader.timer = 10 + (5 * (civData.currency.owned + civData.commerce.owned + civData.stay.owned));

    //then set material and requested amount
    var tradeItems =   // Item and base amount
        [{ materialId : "food",    requested : 5000 },
         { materialId : "wood",    requested : 5000 },
         { materialId : "stone",   requested : 5000 },
         { materialId : "skins",   requested :  500 },
         { materialId : "herbs",   requested :  500 },
         { materialId : "ore",     requested :  500 },
         { materialId : "leather", requested :  250 },
         { materialId : "metal",   requested :  250 }];

    // Randomly select and merge one of the above.
    var selected = tradeItems[Math.floor(Math.random() * tradeItems.length)];
    curCiv.trader.materialId = selected.materialId;
    curCiv.trader.requested = selected.requested * (Math.ceil(Math.random() * 20)); // Up to 20x amount

    document.getElementById("tradeContainer").style.display = "block";
    document.getElementById("tradeType").innerHTML = civData[curCiv.trader.materialId].getQtyName(curCiv.trader.requested);
    document.getElementById("tradeRequested").innerHTML = prettify(curCiv.trader.requested);
}

function trade(){
    //check we have enough of the right type of resources to trade
    if (!curCiv.trader.materialId || (curCiv.trader.materialId.owned < curCiv.trader.requested)) {
        gameLog("Not enough resources to trade.");
        return;
    }

    //subtract resources, add gold
    var material = civData[curCiv.trader.materialId];

    material.owned -= curCiv.trader.requested;
    ++civData.gold.owned;
    updateResourceTotals();
    gameLog("Traded " + curCiv.trader.requested + " " + material.getQtyName(curCiv.trader.requested));
}

function buy(materialId){
    var material = civData[materialId];
    if (civData.gold.owned < 1) { return; }
    --civData.gold.owned;

    if (material == civData.food    || material == civData.wood  || material == civData.stone) { material.owned += 5000; }
    if (material == civData.skins   || material == civData.herbs || material == civData.ore)   { material.owned +=  500; }
    if (material == civData.leather || material == civData.metal)                              { material.owned +=  250; }

    updateResourceTotals();
}

function getWonderCostMultiplier() { // Based on the most wonders in any single resource.
    var i;
    var mostWonders = 0;
    for (i in wonderCount) { if (wonderCount.hasOwnProperty(i)) { mostWonders = Math.max(mostWonders,wonderCount[i]); }}
    return Math.pow(1.5,mostWonders);
}

function speedWonder(){
    if (civData.gold.owned < 100) { return; }
    civData.gold.owned -= 100;

    curCiv.curWonder.progress += 1 / getWonderCostMultiplier();
    curCiv.curWonder.rushed = true;
    updateWonder();
}

// Game infrastructure functions

function handleStorageError(err)
{
    var msg;
    if ((err instanceof DOMException) && (err.code == DOMException.SECURITY_ERR))
        { msg = "Browser security settings blocked access to local storage."; }
    else 
        { msg = "Cannot access localStorage - browser may not support localStorage, or storage may be corrupt"; }
    console.log(err.toString());
    console.log(msg);
}

// Migrate an old savegame to the current format.
// settingsVarReturn is assumed to be a struct containing a property 'val',
//   which will be initialized with the new settingsVar object.
//   (We can't set the outer variable directly from within a function)
function migrateGameData(loadVar, settingsVarReturn)
{
    // BACKWARD COMPATIBILITY SECTION //////////////////
    // v1.1.35: eliminated 2nd variable
    
    // v1.1.13: population.corpses moved to corpses.total
    if (!isValid(loadVar.corpses)) { loadVar.corpses = {}; }
    if (isValid(loadVar.population) && isValid(loadVar.population.corpses)) { 
        if (!isValid(loadVar.corpses.total)) { 
            loadVar.corpses.total = loadVar.population.corpses; 
        }
        delete loadVar.population.corpses; 
    }
    // v1.1.17: population.apothecaries moved to population.healers 
    if (isValid(loadVar.population) && isValid(loadVar.population.apothecaries)) { 
        if (!isValid(loadVar.population.healers)) { 
            loadVar.population.healers = loadVar.population.apothecaries; 
        }
        delete loadVar.population.apothecaries; 
    }

    // v1.1.28: autosave changed to a bool
    loadVar.autosave = (loadVar.autosave !== false && loadVar.autosave !== "off");

    // v1.1.29: 'deity' upgrade renamed to 'worship'
    if (isValid(loadVar.upgrades) && isValid(loadVar.upgrades.deity)) { 
        if (!isValid(loadVar.upgrades.worship)) { 
            loadVar.upgrades.worship = loadVar.upgrades.deity; 
        }
        delete loadVar.upgrades.deity;
    }
    // v1.1.30: Upgrade flags converted from int to bool (should be transparent)
    // v1.1.31: deity.devotion moved to devotion.total.
    if (!isValid(loadVar.devotion)) { loadVar.devotion = {}; }
    if (isValid(loadVar.deity) && isValid(loadVar.deity.devotion)) { 
        if (!isValid(loadVar.devotion.total)) { 
            loadVar.devotion.total = loadVar.deity.devotion; 
        }
        delete loadVar.deity.devotion; 
    }
    // v1.1.33: Achievement flags converted from int to bool (should be transparent)
    // v1.1.33: upgrades.deityType no longer used
    if (isValid(loadVar.upgrades)) { delete loadVar.upgrades.deityType; }

    // v1.1.34: Most efficiency values now recomputed from base values.
    if (isValid(loadVar.efficiency)) {
        loadVar.efficiency = {happiness: loadVar.efficiency.happiness };
    }
    
    // v1.1.38: Most assets moved to curCiv substructure
    if (!isValid(loadVar.curCiv)) { 
        loadVar.curCiv = {
            civName: loadVar.civName,
            rulerName: loadVar.rulerName,

            // Migrate resources
            food : { owned:loadVar.food.total, net:(loadVar.food.net||0) },
            wood : { owned:loadVar.wood.total, net:(loadVar.wood.net||0) },
            stone : { owned:loadVar.stone.total, net:(loadVar.stone.net||0) },
            skins : { owned:loadVar.skins.total },
            herbs : { owned:loadVar.herbs.total },
            ore : { owned:loadVar.ore.total },
            leather : { owned:loadVar.leather.total },
            metal : { owned:loadVar.metal.total },
            piety : { owned:loadVar.piety.total },
            gold : { owned:loadVar.gold.total },
            corpses : { owned:loadVar.corpses.total },
            devotion : { owned:loadVar.devotion.total },

            // land (total land) is now stored as free land, so do that calculation.
            freeLand: { owned: loadVar.land - ( loadVar.tent.total + loadVar.whut.total + loadVar.cottage.total 
            + loadVar.house.total + loadVar.mansion.total + loadVar.barn.total + loadVar.woodstock.total 
            + loadVar.stonestock.total + loadVar.tannery.total + loadVar.smithy.total + loadVar.apothecary.total 
            + loadVar.temple.total + loadVar.barracks.total + loadVar.stable.total + loadVar.mill.total 
            + loadVar.graveyard.total + loadVar.fortification.total + loadVar.battleAltar.total 
            + loadVar.fieldsAltar.total + loadVar.underworldAltar.total + loadVar.catAltar.total) },

            // Migrate buildings
            tent : { owned:loadVar.tent.total },
            // Hut ID also changed from 'whut' to 'hut'.
            hut : { owned:loadVar.whut.total },
            cottage : { owned:loadVar.cottage.total },
            house : { owned:loadVar.house.total },
            mansion : { owned:loadVar.mansion.total },
            barn : { owned:loadVar.barn.total },
            woodstock : { owned:loadVar.woodstock.total },
            stonestock : { owned:loadVar.stonestock.total },
            tannery : { owned:loadVar.tannery.total },
            smithy : { owned:loadVar.smithy.total },
            apothecary : { owned:loadVar.apothecary.total },
            temple : { owned:loadVar.temple.total },
            barracks : { owned:loadVar.barracks.total },
            stable : { owned:loadVar.stable.total },
            mill : { owned:loadVar.mill.total },
            graveyard : { owned:loadVar.graveyard.total },
            fortification : { owned:loadVar.fortification.total },
            battleAltar : { owned:loadVar.battleAltar.total },
            fieldsAltar : { owned:loadVar.fieldsAltar.total },
            underworldAltar : { owned:loadVar.underworldAltar.total },
            catAltar : { owned:loadVar.catAltar.total }
        }; 
        // Delete old values.
        delete loadVar.civName;
        delete loadVar.rulerName;
        delete loadVar.food;
        delete loadVar.wood;
        delete loadVar.stone;
        delete loadVar.skins;
        delete loadVar.herbs;
        delete loadVar.ore;
        delete loadVar.leather;
        delete loadVar.metal;
        delete loadVar.piety;
        delete loadVar.gold;
        delete loadVar.corpses;
        delete loadVar.devotion;
        delete loadVar.land;
        delete loadVar.tent;
        delete loadVar.whut;
        delete loadVar.cottage;
        delete loadVar.house;
        delete loadVar.mansion;
        delete loadVar.barn;
        delete loadVar.woodstock;
        delete loadVar.stonestock;
        delete loadVar.tannery;
        delete loadVar.smithy;
        delete loadVar.apothecary;
        delete loadVar.temple;
        delete loadVar.barracks;
        delete loadVar.stable;
        delete loadVar.mill;
        delete loadVar.graveyard;
        delete loadVar.fortification;
        delete loadVar.battleAltar;
        delete loadVar.fieldsAltar;
        delete loadVar.underworldAltar;
        delete loadVar.catAltar;
    }

    if (isValid(loadVar.upgrades)) {
        // Migrate upgrades
        loadVar.curCiv.skinning = { owned:loadVar.upgrades.skinning };
        loadVar.curCiv.harvesting = { owned:loadVar.upgrades.harvesting };
        loadVar.curCiv.prospecting = { owned:loadVar.upgrades.prospecting };
        loadVar.curCiv.domestication = { owned:loadVar.upgrades.domestication };
        loadVar.curCiv.ploughshares = { owned:loadVar.upgrades.ploughshares };
        loadVar.curCiv.irrigation = { owned:loadVar.upgrades.irrigation };
        loadVar.curCiv.butchering = { owned:loadVar.upgrades.butchering };
        loadVar.curCiv.gardening = { owned:loadVar.upgrades.gardening };
        loadVar.curCiv.extraction = { owned:loadVar.upgrades.extraction };
        loadVar.curCiv.flensing = { owned:loadVar.upgrades.flensing };
        loadVar.curCiv.macerating = { owned:loadVar.upgrades.macerating };
        loadVar.curCiv.croprotation = { owned:loadVar.upgrades.croprotation };
        loadVar.curCiv.selectivebreeding = { owned:loadVar.upgrades.selectivebreeding };
        loadVar.curCiv.fertilisers = { owned:loadVar.upgrades.fertilisers };
        loadVar.curCiv.masonry = { owned:loadVar.upgrades.masonry };
        loadVar.curCiv.construction = { owned:loadVar.upgrades.construction };
        loadVar.curCiv.architecture = { owned:loadVar.upgrades.architecture };
        loadVar.curCiv.tenements = { owned:loadVar.upgrades.tenements };
        loadVar.curCiv.slums = { owned:loadVar.upgrades.slums };
        loadVar.curCiv.granaries = { owned:loadVar.upgrades.granaries };
        loadVar.curCiv.palisade = { owned:loadVar.upgrades.palisade };
        loadVar.curCiv.weaponry = { owned:loadVar.upgrades.weaponry };
        loadVar.curCiv.shields = { owned:loadVar.upgrades.shields };
        loadVar.curCiv.horseback = { owned:loadVar.upgrades.horseback };
        loadVar.curCiv.wheel = { owned:loadVar.upgrades.wheel };
        loadVar.curCiv.writing = { owned:loadVar.upgrades.writing };
        loadVar.curCiv.administration = { owned:loadVar.upgrades.administration };
        loadVar.curCiv.codeoflaws = { owned:loadVar.upgrades.codeoflaws };
        loadVar.curCiv.mathematics = { owned:loadVar.upgrades.mathematics };
        loadVar.curCiv.aesthetics = { owned:loadVar.upgrades.aesthetics };
        loadVar.curCiv.civilservice = { owned:loadVar.upgrades.civilservice };
        loadVar.curCiv.feudalism = { owned:loadVar.upgrades.feudalism };
        loadVar.curCiv.guilds = { owned:loadVar.upgrades.guilds };
        loadVar.curCiv.serfs = { owned:loadVar.upgrades.serfs };
        loadVar.curCiv.nationalism = { owned:loadVar.upgrades.nationalism };
        loadVar.curCiv.worship = { owned:loadVar.upgrades.worship };
        loadVar.curCiv.lure = { owned:loadVar.upgrades.lure };
        loadVar.curCiv.companion = { owned:loadVar.upgrades.companion };
        loadVar.curCiv.comfort = { owned:loadVar.upgrades.comfort };
        loadVar.curCiv.blessing = { owned:loadVar.upgrades.blessing };
        loadVar.curCiv.waste = { owned:loadVar.upgrades.waste };
        loadVar.curCiv.stay = { owned:loadVar.upgrades.stay };
        loadVar.curCiv.riddle = { owned:loadVar.upgrades.riddle };
        loadVar.curCiv.throne = { owned:loadVar.upgrades.throne };
        loadVar.curCiv.lament = { owned:loadVar.upgrades.lament };
        loadVar.curCiv.book = { owned:loadVar.upgrades.book };
        loadVar.curCiv.feast = { owned:loadVar.upgrades.feast };
        loadVar.curCiv.secrets = { owned:loadVar.upgrades.secrets };
        loadVar.curCiv.standard = { owned:loadVar.upgrades.standard };
        loadVar.curCiv.trade = { owned:loadVar.upgrades.trade };
        loadVar.curCiv.currency = { owned:loadVar.upgrades.currency };
        loadVar.curCiv.commerce = { owned:loadVar.upgrades.commerce };
        delete loadVar.upgrades;
    }
    if (isValid(loadVar.achievements)) {
        // Migrate achievements
        loadVar.curCiv.hamletAch = { owned:loadVar.achievements.hamlet };
        loadVar.curCiv.villageAch = { owned:loadVar.achievements.village };
        loadVar.curCiv.smallTownAch = { owned:loadVar.achievements.smallTown };
        loadVar.curCiv.largeTownAch = { owned:loadVar.achievements.largeTown };
        loadVar.curCiv.smallCityAch = { owned:loadVar.achievements.smallCity };
        loadVar.curCiv.largeCityAch = { owned:loadVar.achievements.largeCity };
        loadVar.curCiv.metropolisAch = { owned:loadVar.achievements.metropolis };
        loadVar.curCiv.smallNationAch = { owned:loadVar.achievements.smallNation };
        loadVar.curCiv.nationAch = { owned:loadVar.achievements.nation };
        loadVar.curCiv.largeNationAch = { owned:loadVar.achievements.largeNation };
        loadVar.curCiv.empireAch = { owned:loadVar.achievements.empire };
        loadVar.curCiv.raiderAch = { owned:loadVar.achievements.raider };
        loadVar.curCiv.engineerAch = { owned:loadVar.achievements.engineer };
        loadVar.curCiv.dominationAch = { owned:loadVar.achievements.domination };
        loadVar.curCiv.hatedAch = { owned:loadVar.achievements.hated };
        loadVar.curCiv.lovedAch = { owned:loadVar.achievements.loved };
        loadVar.curCiv.catAch = { owned:loadVar.achievements.cat };
        loadVar.curCiv.glaringAch = { owned:loadVar.achievements.glaring };
        loadVar.curCiv.clowderAch = { owned:loadVar.achievements.clowder };
        loadVar.curCiv.battleAch = { owned:loadVar.achievements.battle };
        loadVar.curCiv.catsAch = { owned:loadVar.achievements.cats };
        loadVar.curCiv.fieldsAch = { owned:loadVar.achievements.fields };
        loadVar.curCiv.underworldAch = { owned:loadVar.achievements.underworld };
        loadVar.curCiv.fullHouseAch = { owned:loadVar.achievements.fullHouse };
        // ID 'plague' changed to 'plagued'.
        loadVar.curCiv.plaguedAch = { owned:loadVar.achievements.plague };
        loadVar.curCiv.ghostTownAch = { owned:loadVar.achievements.ghostTown };
        loadVar.curCiv.wonderAch = { owned:loadVar.achievements.wonder };
        loadVar.curCiv.sevenAch = { owned:loadVar.achievements.seven };
        loadVar.curCiv.merchantAch = { owned:loadVar.achievements.merchant };
        loadVar.curCiv.rushedAch = { owned:loadVar.achievements.rushed };
        loadVar.curCiv.neverclickAch = { owned:loadVar.achievements.neverclick };
        delete loadVar.achievements;
    }
    if (isValid(loadVar.population)) {
        // Migrate population
        loadVar.curCiv.cat = { owned:loadVar.population.cats };
        loadVar.curCiv.zombie = { owned:loadVar.population.zombies };
        loadVar.curCiv.grave = { owned:loadVar.population.graves };
        loadVar.curCiv.unemployed = { owned:loadVar.population.unemployed };
        loadVar.curCiv.farmer = { owned:loadVar.population.farmers };
        loadVar.curCiv.woodcutter = { owned:loadVar.population.woodcutters };
        loadVar.curCiv.miner = { owned:loadVar.population.miners };
        loadVar.curCiv.tanner = { owned:loadVar.population.tanners };
        loadVar.curCiv.blacksmith = { owned:loadVar.population.blacksmiths };
        loadVar.curCiv.healer = { owned:loadVar.population.healers };
        loadVar.curCiv.cleric = { owned:loadVar.population.clerics };
        loadVar.curCiv.labourer = { owned:loadVar.population.labourers };
        loadVar.curCiv.soldier = { owned:loadVar.population.soldiers };
        loadVar.curCiv.cavalry = { owned:loadVar.population.cavalry };
        loadVar.curCiv.soldierParty = { owned:loadVar.population.soldiersParty };
        loadVar.curCiv.cavalryParty = { owned:loadVar.population.cavalryParty };
        loadVar.curCiv.siege = { owned:loadVar.population.siege };
        loadVar.curCiv.esoldier = { owned:loadVar.population.esoldiers };
        loadVar.curCiv.efort = { owned:loadVar.population.eforts };
        loadVar.curCiv.unemployedIll = { owned:loadVar.population.unemployedIll };
        loadVar.curCiv.farmerIll = { owned:loadVar.population.farmersIll };
        loadVar.curCiv.woodcutterIll = { owned:loadVar.population.woodcuttersIll };
        loadVar.curCiv.minerIll = { owned:loadVar.population.minersIll };
        loadVar.curCiv.tannerIll = { owned:loadVar.population.tannersIll };
        loadVar.curCiv.blacksmithIll = { owned:loadVar.population.blacksmithsIll };
        loadVar.curCiv.healerIll = { owned:loadVar.population.healersIll };
        loadVar.curCiv.clericIll = { owned:loadVar.population.clericsIll };
        loadVar.curCiv.labourerIll = { owned:loadVar.population.labourersIll };
        loadVar.curCiv.soldierIll = { owned:loadVar.population.soldiersIll };
        loadVar.curCiv.cavalryIll = { owned:loadVar.population.cavalryIll };
        loadVar.curCiv.wolf = { owned:loadVar.population.wolves };
        loadVar.curCiv.bandit = { owned:loadVar.population.bandits };
        loadVar.curCiv.barbarian = { owned:loadVar.population.barbarians };
        loadVar.curCiv.esiege = { owned:loadVar.population.esiege };
        loadVar.curCiv.enemySlain = { owned:loadVar.population.enemiesSlain };
        loadVar.curCiv.shade = { owned:loadVar.population.shades };
        delete loadVar.population;
    }

    // v1.1.38: Game settings moved to settings object, but we deliberately
    // don't try to migrate them.  'autosave', 'worksafe', and 'fontSize'
    // values from earlier versions will be discarded.

    // v1.1.39: Migrate more save fields into curCiv.
    if (isValid(loadVar.resourceClicks)){ 
        loadVar.curCiv.resourceClicks = loadVar.resourceClicks;
        delete loadVar.resourceClicks;
    }
    if (!isValid(loadVar.curCiv.resourceClicks)){
        loadVar.curCiv.resourceClicks = 999; //stops people getting the achievement with an old save version
    }
    if (isValid(loadVar.graceCost)){ 
        loadVar.curCiv.graceCost = loadVar.graceCost;
        delete loadVar.graceCost;
    }
    if (isValid(loadVar.walkTotal)){ 
        loadVar.curCiv.walkTotal = loadVar.walkTotal;
        delete loadVar.walkTotal;
    }

    // v1.1.39: Migrate deities to use IDs.
    if (isValid(loadVar.deityArray))
    {
        loadVar.curCiv.deities = [];
        loadVar.deityArray.forEach(function(row) {
            loadVar.curCiv.deities.unshift({ name: row[1], domain: typeToId(row[2]), maxDev: row[3] });
        });
        delete loadVar.deityArray;
    }

    if (isValid(loadVar.deity) && isValid(loadVar.curCiv.devotion))
    {
        loadVar.curCiv.deities.unshift({ name: loadVar.deity.name, domain: typeToId(loadVar.deity.type), maxDev: loadVar.curCiv.devotion.owned });
        delete loadVar.deity;
    }

    // v1.1.39: Settings moved to their own variable
    if (isValid(loadVar.settings))
    {
        settingsVarReturn.val = loadVar.settings;
        delete loadVar.settings;
    }

    // v1.1.39: Raiding now stores enemy population instead of 'iterations'.
    if (isValid(loadVar.raiding) && isValid(loadVar.raiding.iterations))
    {
        loadVar.raiding.epop = loadVar.raiding.iterations * 20;
        // Plunder calculations now moved to the start of the raid.
        // This should rarely happen, but give a consolation prize.
        loadVar.raiding.plunderLoot = { gold: 1 };
        delete loadVar.raiding.iterations;
    }

    if (isValid(loadVar.throneCount)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.throne)) { loadVar.curCiv.throne = {}; }
        loadVar.curCiv.throne.count = loadVar.throneCount||0;
        delete loadVar.throneCount;
    }

    if (isValid(loadVar.gloryTimer)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.glory)) { loadVar.curCiv.glory = {}; }
        loadVar.curCiv.glory.timer = loadVar.gloryTimer||0;
        delete loadVar.gloryTimer;
    }

    if (isValid(loadVar.walkTotal)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.walk)) { loadVar.curCiv.walk = {}; }
        loadVar.curCiv.walk.rate = loadVar.walkTotal||0;
        delete loadVar.walkTotal;
    }

    if (isValid(loadVar.pestTimer)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.pestControl)) { loadVar.curCiv.pestControl = {}; }
        loadVar.curCiv.pestControl.timer = loadVar.pestTimer||0;
        delete loadVar.pestTimer;
    }

    if (isValid(loadVar.graceCost)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.grace)) { loadVar.curCiv.grace = {}; }
        loadVar.curCiv.grace.cost = loadVar.graceCost||1000;
        delete loadVar.graceCost;
    }

    if (isValid(loadVar.cureCounter)) // v1.1.55: Moved to substructure
    {
        if (!isValid(loadVar.curCiv.healer)) { loadVar.curCiv.healer = {}; }
        loadVar.curCiv.healer.cureCount = loadVar.cureCounter||0;
        delete loadVar.cureCounter;
    }

    if (isValid(loadVar.efficiency)) // v1.1.59: efficiency.happiness moved to curCiv.morale.efficiency.
    {
        if (!isValid(loadVar.curCiv.morale)) { loadVar.curCiv.morale = {}; }
        loadVar.curCiv.morale.efficiency = loadVar.efficiency.happiness||1.0;
        delete loadVar.efficiency; // happiness was the last remaining efficiency subfield.
    }

    if (isValid(loadVar.raiding)) // v1.1.59: raiding moved to curCiv.raid
    {
        if (!isValid(loadVar.curCiv.raid)) { loadVar.curCiv.raid = loadVar.raiding; }
        delete loadVar.raiding;
    }

    if (isValid(loadVar.targetMax)) // v1.1.59: targeMax moved to curCiv.raid.targetMax
    {
        if (!isValid(loadVar.curCiv.raid)) { loadVar.curCiv.raid = {}; }
        loadVar.curCiv.raid.targetMax = loadVar.targetMax;
        delete loadVar.targetMax;
    }

    if (isValid(loadVar.curCiv.tradeCounter)) // v1.1.59: curCiv.tradeCounter moved to curCiv.trader.counter
    {
        if (!isValid(loadVar.curCiv.trader)) { loadVar.curCiv.trader = {}; }
        loadVar.curCiv.trader.counter = loadVar.curCiv.tradeCounter||0;
        delete loadVar.curCiv.tradeCounter;
    }

    if (isValid(loadVar.wonder.array)) // v1.1.59: wonder.array moved to curCiv.wonders
    {
        if (!isValid(loadVar.curCiv.wonders)) { 
            loadVar.curCiv.wonders = [];
            loadVar.wonder.array.forEach(function(elem) {
                // Format converted from [name,resourceId] to {name: name, resourceId: resourceId}
                loadVar.curCiv.wonders.push({name: elem[0], resourceId: elem[1]});
            });
        }
        delete loadVar.wonder.array;
    }

    if (isValid(loadVar.wonder)) // v1.1.59: wonder moved to curCiv.curWonder
    {
        if (isValid(loadVar.wonder.total  )) { delete loadVar.wonder.total;   } // wonder.total no longer used.
        if (isValid(loadVar.wonder.food   )) { delete loadVar.wonder.food;    } // wonder.food no longer used.
        if (isValid(loadVar.wonder.wood   )) { delete loadVar.wonder.wood;    } // wonder.wood no longer used.
        if (isValid(loadVar.wonder.stone  )) { delete loadVar.wonder.stone;   } // wonder.stone no longer used.
        if (isValid(loadVar.wonder.skins  )) { delete loadVar.wonder.skins;   } // wonder.skins no longer used.
        if (isValid(loadVar.wonder.herbs  )) { delete loadVar.wonder.herbs;   } // wonder.herbs no longer used.
        if (isValid(loadVar.wonder.ore    )) { delete loadVar.wonder.ore;     } // wonder.ore no longer used.
        if (isValid(loadVar.wonder.leather)) { delete loadVar.wonder.leather; } // wonder.leather no longer used.
        if (isValid(loadVar.wonder.piety  )) { delete loadVar.wonder.piety;   } // wonder.piety no longer used.
        if (isValid(loadVar.wonder.metal  )) { delete loadVar.wonder.metal;   } // wonder.metal no longer used.
        if (!isValid(loadVar.wonder.stage) && isValid(loadVar.wonder.building) && isValid(loadVar.wonder.completed)) {
            // This ugly formula merges the 'building' and 'completed' fields into 'stage'.
            loadVar.wonder.stage = (2*loadVar.wonder.completed) + (loadVar.wonder.building != loadVar.wonder.completed);
            delete loadVar.wonder.building;
            delete loadVar.wonder.completed;
        }
        if (!isValid(loadVar.curCiv.curWonder)) { loadVar.curCiv.curWonder = loadVar.wonder; }
        delete loadVar.wonder;
    }
    ////////////////////////////////////////////////////
}

// Load in saved data
function load(loadType){
    //define load variables
    var loadVar = {},
        loadVar2 = {},
        settingsVar = {};
        
    if (loadType === "cookie"){
        //check for cookies
        if (read_cookie(saveTag) && read_cookie(saveTag2)){
            //set variables to load from
            loadVar = read_cookie(saveTag);
            loadVar2 = read_cookie(saveTag2);
            loadVar = mergeObj(loadVar, loadVar2);
            loadVar2 = undefined;
            //notify user
            gameLog("Loaded saved game from cookie");
            gameLog("Save system switching to localStorage.");
        } else {
            console.log("Unable to find cookie");
            return false;
        }
    }
    
    if (loadType === "localStorage"){
        //check for local storage
        var string1;
        var string2;
        var settingsString;
        try {
            settingsString = localStorage.getItem(saveSettingsTag);
            string1 = localStorage.getItem(saveTag);
            string2 = localStorage.getItem(saveTag2);

            if (!string1) {
                console.log("Unable to find variables in localStorage. Attempting to load cookie.");
                return load("cookie");
            }

        } catch(err) {
            if (!string1) { // It could be fine if string2 or settingsString fail.
                handleStorageError(err);
                return load("cookie");
            }
        }
        
        // Try to parse the strings
        if (string1) { try { loadVar  = JSON.parse(string1); } catch(ignore){} }
        if (string2) { try { loadVar2 = JSON.parse(string2); } catch(ignore){} }
        if (settingsString) { try { settingsVar = JSON.parse(settingsString); } catch(ignore){} }

        // If there's a second string (old save game format), merge it in.
        if (loadVar2) { loadVar = mergeObj(loadVar, loadVar2); loadVar2 = undefined; }

        if (!loadVar) {
            console.log("Unable to parse variables in localStorage. Attempting to load cookie.");
            return load("cookie");
        }

        //notify user
        gameLog("Loaded saved game from localStorage");
    }
    
    if (loadType === "import"){
        //take the import string, decompress and parse it
        var compressed = document.getElementById("impexpField").value;
        var decompressed = LZString.decompressFromBase64(compressed);
        var revived = JSON.parse(decompressed);
        //set variables to load from
        loadVar = revived[0];
        if (isValid(revived[1])) {
            loadVar2 = revived[1];
            // If there's a second string (old save game format), merge it in.
            if (loadVar2) { loadVar = mergeObj(loadVar, loadVar2); loadVar2 = undefined; }
        }
        if (!loadVar) {
            console.log("Unable to parse saved game string.");
            return false;
        }

        //notify user
        gameLog("Imported saved game");
        //close import/export dialog
        //impexp();
    }

    var saveVersion = new VersionData(1,0,0,"legacy");
    saveVersion = mergeObj(saveVersion,loadVar.versionData);
    if (saveVersion.toNumber() > versionData.toNumber())
    {
        // Refuse to load saved games from future versions.
        var alertStr = "Cannot load; saved game version " + saveVersion + " is newer than game version " + versionData;
        console.log(alertStr);
        alert(alertStr);
        return false;
    } 
    if (saveVersion.toNumber() < versionData.toNumber()) {
        // Migrate saved game data from older versions.
        var settingsVarReturn = { val: {} };
        migrateGameData(loadVar,settingsVarReturn);
        settingsVar = settingsVarReturn.val;

        // Merge the loaded data into our own, in case we've added fields.
        mergeObj(curCiv, loadVar.curCiv);
    }
    else {
        curCiv = loadVar.curCiv; // No need to merge if the versions match; this is quicker.
    }

    console.log("Loaded save game version " + saveVersion.major +
        "." + saveVersion.minor + "." + saveVersion.sub + "(" + saveVersion.mod + ").");

    if (isValid(settingsVar)){ settings = mergeObj(settings,settingsVar); }
 
    adjustMorale(0);
    updateRequirements(civData.mill);
    updateRequirements(civData.fortification);
    updateRequirements(civData.battleAltar);
    updateRequirements(civData.fieldsAltar);
    updateRequirements(civData.underworldAltar);
    updateRequirements(civData.catAltar);
    updateResourceTotals();
    updateJobButtons();
    makeDeitiesTables();
    updateDeity();
    updateUpgrades();
    updateTargets();
    updateDevotion();
    updatePartyButtons();
    updateMorale();
    updateWonder();
    updateWonderCount();
    document.getElementById("clicks").innerHTML = prettify(Math.round(curCiv.resourceClicks));
    document.getElementById("civName").innerHTML = curCiv.civName;
    document.getElementById("rulerName").innerHTML = curCiv.rulerName;
    document.getElementById("wonderNameP").innerHTML = curCiv.curWonder.name;
    document.getElementById("wonderNameC").innerHTML = curCiv.curWonder.name;

    return true;
}

// Create objects and populate them with the variables, these will be stored in HTML5 localStorage.
// Cookie-based saves are no longer supported.
function save(savetype){
    var xmlhttp;

    var saveVar = {
        versionData:versionData, // Version information header
        curCiv:curCiv // Game data
    };

    var settingsVar = settings; // UI Settings are saved separately.

    ////////////////////////////////////////////////////

    // Handle export
    if (savetype == "export"){
        var savestring = "[" + JSON.stringify(saveVar) + "]";
        var compressed = LZString.compressToBase64(savestring);
        console.log("Compressed save from " + savestring.length + " to " + compressed.length + " characters");
        document.getElementById("impexpField").value = compressed;
        gameLog("Exported game to text");
        return true;
    }

    //set localstorage
    try {
        // Delete the old cookie-based save to avoid mismatched saves
        deleteCookie(saveTag);
        deleteCookie(saveTag2);

        localStorage.setItem(saveTag, JSON.stringify(saveVar));

        // We always save the game settings.
        localStorage.setItem(saveSettingsTag, JSON.stringify(settingsVar));

        //Update console for debugging, also the player depending on the type of save (manual/auto)
        if (savetype == "auto"){
            console.log("Autosave");
            gameLog("Autosaved");
        } else if (savetype == "manual"){
            alert("Game Saved");
            console.log("Manual Save");
            gameLog("Saved game");
        }
    } catch(err) {
        handleStorageError(err);

        if (savetype == "auto"){
            console.log("Autosave Failed");
            gameLog("Autosave Failed");
        } else if (savetype == "manual"){
            alert("Save Failed!");
            console.log("Save Failed");
            gameLog("Save Failed");
        }
        return false;
    }

    try {
        xmlhttp = new XMLHttpRequest();
        xmlhttp.overrideMimeType("text/plain");
        xmlhttp.open("GET", "version.txt?r=" + Math.random(),true);
        xmlhttp.onreadystatechange=function() {
            if (xmlhttp.readyState==4) {
                var sVersion = parseInt(xmlhttp.responseText,10);
                if (version < sVersion){
                    versionAlert();
                }
            }
        };
        xmlhttp.send(null);
    } catch (err) {
        console.log("XMLHttpRequest failed");
    }

    return true;
}

function deleteSave(){
    //Deletes the current savegame by setting the game's cookies to expire in the past.
    if (!confirm("Really delete save?")) { return; } //Check the player really wanted to do that.

    try {
        deleteCookie(saveTag);
        deleteCookie(saveTag2);
        localStorage.removeItem(saveTag);
        localStorage.removeItem(saveTag2);
        localStorage.removeItem(saveSettingsTag);
        gameLog("Save Deleted");
    } catch(err) {
        handleStorageError(err);
        alert("Save Deletion Failed!");
    }
}

function renameCiv(newName){
    //Prompts player, uses result as new civName
    while (!newName) {
        newName = prompt("Please name your civilisation",(newName || curCiv.civName || "Woodstock"));
        if ((newName === null)&&(curCiv.civName)) { return; } // Cancelled
    }

    curCiv.civName = newName;
    document.getElementById("civName").innerHTML = curCiv.civName;
}

// Note:  Returns the index (which could be 0), or 'false'.
function haveDeity(name)
{
    var i;
    for (i=0;i<curCiv.deities.length;++i) { 
        if (curCiv.deities[i].name == name) { return i; } 
    }

    return false;
}

function renameRuler(newName){
    if (curCiv.rulerName == "Cheater") { return; } // Reputations suck, don't they?
    //Prompts player, uses result as rulerName
    while (!newName || haveDeity(newName)!==false) {
        newName = prompt("What is your name?",(newName || curCiv.rulerName || "Orteil"));
        if ((newName === null)&&(curCiv.rulerName)) { return; } // Cancelled
        if (haveDeity(newName)!==false) {
            alert("That would be a blasphemy against the deity "+newName+".");
            newName = "";
        }
    }

    curCiv.rulerName = newName;

    document.getElementById("rulerName").innerHTML = curCiv.rulerName;
}

// Looks to see if the deity already exists.  If it does, that deity
// is moved to the first slot, overwriting the current entry, and the
// player's domain is automatically assigned to match (for free).
function renameDeity(newName){
    var i = false;
    while (!newName) {
        // Default to ruler's name.  Hey, despots tend to have big egos.
        newName = prompt("Whom do your people worship?",(newName || curCiv.deities[0].name || curCiv.rulerName));
        if ((newName === null)&&(curCiv.deities[0].name)) { return; } // Cancelled

        // If haveDeity returns a number > 0, the name is used by a legacy deity.
        // This is only allowed when naming (not renaming) the active deity.
        i = haveDeity(newName);
        if (i && curCiv.deities[0].name) { 
            alert("That deity already exists."); 
            newName = "";
        } 
    }

    // Rename the active deity.
    curCiv.deities[0].name = newName;

    // If the name matches a legacy deity, make the legacy deity the active deity.
    if (i) {
        curCiv.deities[0] = curCiv.deities[i]; // Copy to front position
        curCiv.deities.splice(i,1); // Remove from old position
        if (getCurDeityDomain()) { // Does deity have a domain?
            selectDeity(getCurDeityDomain(),true); // Automatically pick that domain.
        }
    }

    makeDeitiesTables();
}

function reset(){
    //Resets the game, keeping some values but resetting most back to their initial values.
    var msg = "Really reset? You will keep past deities and wonders (and cats)"; //Check player really wanted to do that.
    if (!confirm(msg)) { return false; } // declined

    // Let each data subpoint re-init.
    civData.forEach( function(elem){ if (elem instanceof CivObj) { elem.reset(); } });

    curCiv.zombie.owned = 0;
    curCiv.grave.owned = 0;
    curCiv.enemySlain.owned = 0;
    curCiv.resourceClicks = 0; // For NeverClick
    curCiv.attackCounter = 0; // How long since last attack?
    curCiv.morale = { mod: 1.0 };

    // If our current deity is powerless, delete it.
    if (!curCiv.deities[0].maxDev) {
        curCiv.deities.shift();
    }
    // Insert space for a fresh deity.
    curCiv.deities.unshift({ name:"", domain:"", maxDev:0 });

    updateRequirements(civData.mill);
    updateRequirements(civData.fortification);
    updateRequirements(civData.battleAltar);
    updateRequirements(civData.fieldsAltar);
    updateRequirements(civData.underworldAltar);
    updateRequirements(civData.catAltar);

    population = {
        current:0,
        limit:0,
        healthy:0,
        totalSick:0
    };

    resetRaiding();
    curCiv.raid.targetMax = civSizes[0].id;

    curCiv.trader.materialId="";
    curCiv.trader.requested=0;
    curCiv.trader.timer=0;
    curCiv.trader.counter = 0; // How long since last trader?

    curCiv.curWonder.name = "";
    curCiv.curWonder.stage = 0;
    curCiv.curWonder.rushed = false;
    curCiv.curWonder.progress = 0;

    document.getElementById("graceCost").innerHTML = prettify(civData.grace.cost);
    //Update page with all new values
    updateResourceTotals();
    updateUpgrades();
    updateDeity();
    makeDeitiesTables();
    updateDevotion();
    updateTargets();
    updateJobButtons();
    updatePartyButtons();
    updateWonder();
    //Reset upgrades and other interface elements that might have been unlocked
    //xxx Some of this probably isn't needed anymore; the update routines will handle it.
    document.getElementById("renameDeity").disabled = "true";
    document.getElementById("raiseDead").disabled = "true";
    document.getElementById("raiseDead100").disabled = "true";
    document.getElementById("raiseDeadMax").disabled = "true";
    document.getElementById("smite").disabled = "true";
    document.getElementById("wickerman").disabled = "true";
    document.getElementById("pestControl").disabled = "true";
    document.getElementById("grace").disabled = "true";
    document.getElementById("walk").disabled = "true";
    document.getElementById("ceaseWalk").disabled = "true";
    document.getElementById("lure").disabled = "true";
    document.getElementById("companion").disabled = "true";
    document.getElementById("comfort").disabled = "true";
    document.getElementById("book").disabled = "true";
    document.getElementById("feast").disabled = "true";
    document.getElementById("blessing").disabled = "true";
    document.getElementById("waste").disabled = "true";
    document.getElementById("riddle").disabled = "true";
    document.getElementById("throne").disabled = "true";
    document.getElementById("glory").disabled = "true";
    document.getElementById("summonShade").disabled = "true";

    setElemDisplay("deitySelect",(civData.temple.owned > 0));
    setElemDisplay("conquestSelect",(civData.barracks.owned > 0));
    setElemDisplay("tradeSelect",(civData.gold.owned > 0));

    document.getElementById("conquest").style.display = "none";

    document.getElementById("tradeContainer").style.display = "none";
    document.getElementById("tradeUpgradeContainer").style.display = "none";
    document.getElementById("iconoclasmList").innerHTML = "";
    document.getElementById("iconoclasm").disabled = false;
    gameLog("Game Reset"); //Inform player.

    renameCiv();
    renameRuler();

    return true;
}

function tickAutosave() {
    if (settings.autosave && (++settings.autosaveCounter >= settings.autosaveTime)){ 
        settings.autosaveCounter = 0;
        // If autosave fails, disable it.
        if (!save("auto")) { settings.autosave = false; }
    }
}

//xxx Need to improve 'net' handling.
function doFarmers() {
    var specialChance = civData.food.specialChance + (0.1 * civData.flensing.owned);
    var millMod = 1;
    if (population.current > 0 || curCiv.zombie.owned > 0) { millMod = population.current / (population.current + curCiv.zombie.owned); }
    civData.food.net = civData.farmer.owned * (1 + (civData.farmer.efficiency * curCiv.morale.efficiency)) * ((civData.pestControl.timer > 0) ? 1.01 : 1) * getWonderBonus(civData.food) * (1 + civData.walk.rate/120) * (1 + civData.mill.owned * millMod / 200); //Farmers farm food
    civData.food.net -= population.current; //The living population eats food.
    civData.food.owned += civData.food.net;
    if (civData.skinning.owned && civData.farmer.owned > 0){ //and sometimes get skins
        var num_skins = specialChance * (civData.food.increment + ((civData.butchering.owned) * civData.farmer.owned / 15.0)) * getWonderBonus(civData.skins);
        civData.skins.owned += rndRound(num_skins);
    }
}
function doWoodcutters() {
    civData.wood.net = civData.woodcutter.owned * (civData.woodcutter.efficiency * curCiv.morale.efficiency) * getWonderBonus(civData.wood); //Woodcutters cut wood
    civData.wood.owned += civData.wood.net;
    if (civData.harvesting.owned && civData.woodcutter.owned > 0){ //and sometimes get herbs
        var num_herbs = civData.wood.specialChance * (civData.wood.increment + ((civData.gardening.owned) * civData.woodcutter.owned / 5.0)) * getWonderBonus(civData.herbs);
        civData.herbs.owned += rndRound(num_herbs);
    }
}

function doMiners() {
    var specialChance = civData.stone.specialChance + (civData.macerating.owned ? 0.1 : 0);
    civData.stone.net = civData.miner.owned * (civData.miner.efficiency * curCiv.morale.efficiency) * getWonderBonus(civData.stone); //Miners mine stone
    civData.stone.owned += civData.stone.net;
    if (civData.prospecting.owned && civData.miner.owned > 0){ //and sometimes get ore
        var num_ore = specialChance * (civData.stone.increment + ((civData.extraction.owned) * civData.miner.owned / 5.0)) * getWonderBonus(civData.ore);
        civData.ore.owned += rndRound(num_ore);
    }
}

function doBlacksmiths() {
    var numUsed = Math.min(civData.ore.owned, (civData.blacksmith.owned * civData.blacksmith.efficiency * curCiv.morale.efficiency));
    civData.ore.owned -= numUsed;
    civData.metal.owned += numUsed * getWonderBonus(civData.metal);
}

function doTanners() {
    var numUsed = Math.min(civData.skins.owned, (civData.tanner.owned * civData.tanner.efficiency * curCiv.morale.efficiency));
    civData.skins.owned -= numUsed;
    civData.leather.owned += numUsed * getWonderBonus(civData.leather);
}

function doClerics() {
    civData.piety.owned += civData.cleric.owned * (civData.cleric.efficiency + (civData.cleric.efficiency * (civData.writing.owned))) * (1 + ((civData.secrets.owned) * (1 - 100/(civData.graveyard.owned + 100)))) * curCiv.morale.efficiency * getWonderBonus(civData.piety);
}
// Try to heal the specified number of people in the specified job
// Makes them sick if the number is negative.
function heal(job,num)
{
    if (!isValid(job) || !job) { return 0; }
    if (num === undefined) { num = 1; } // default to 1
    num = Math.min(num,civData[job].ill);
    num = Math.max(num,-civData[job].owned);
    civData[job].ill -= num;
    population.totalSick -= num;
    civData[job].owned += num;
    population.healthy += num;

    return num;
}

//Selects random workers, transfers them to their Ill variants
function plague(sickNum){
    var actualNum = 0;
    var i;

    updatePopulation();
    // Apply in 1-worker groups to spread it out.
    for (i=0;i<sickNum;i++){ actualNum += -heal(randomHealthyWorker(),-1); }

    return actualNum;
}

// Select a sick worker type to cure, with certain priorities
function getNextPatient()
{ 
    var i;
    //xxx Need to generalize this list.
    var jobs=["healer","cleric","farmer","soldier","cavalry","labourer",
        "woodcutter","miner","tanner","blacksmith","unemployed"];
    for (i=0;i<jobs.length;++i)
    {
        if (civData[jobs[i]].ill > 0) { return jobs[i]; }
    }

    return "";
}

function doHealers() {
    var job, numHealed = 0;
    var numHealers = civData.healer.owned + (civData.cat.owned * (civData.companion.owned));

    // How much healing can we do?
    civData.healer.cureCount += (numHealers * civData.healer.efficiency * curCiv.morale.efficiency);

    // We can't cure more sick people than there are
    civData.healer.cureCount = Math.min(civData.healer.cureCount, population.totalSick);

    // Cure people until we run out of healing capacity or herbs
    while (civData.healer.cureCount >= 1 && civData.herbs.owned >= 1) {
        job = getNextPatient();
        if (!job) { break; }
        heal(job); 
        --civData.healer.cureCount;
        --civData.herbs.owned;
        ++numHealed;
    }

    return numHealed;
}

function doGraveyards()
{
    var i;
    if (civData.corpses.owned > 0 && curCiv.grave.owned > 0){
        //Clerics will bury corpses if there are graves to fill and corpses lying around
        for (i=0;i<civData.cleric.owned;i++){
            if (civData.corpses.owned > 0 && curCiv.grave.owned > 0){
                civData.corpses.owned -= 1;
                curCiv.grave.owned -= 1;
            }
        }
        updatePopulationUI();
    }
}

function doCorpses() {
    if (civData.corpses.owned <= 0) { return; }

    // Corpses lying around will occasionally make people sick.
    // 1-in-50 chance (1-in-100 with feast)
    var sickChance = 50 * Math.random() * (1 + civData.feast.owned);
    if (sickChance >= 1) { return; }

    // Infect up to 1% of the population.
    var num = Math.floor(population.current/100 * Math.random());
    if (num <= 0) {  return; }

    num = plague(num);
    if (num > 0) {
        updatePopulation();
        gameLog(prettify(num) + " workers got sick"); //notify player
    }
}

// Returns all of the combatants present for a given place and alignment that.
function getCombatants(place, alignment)
{
    return unitData.filter(function(elem) { 
        return ((elem.alignment == alignment) && (elem.place == place)
             && (elem.combatType)            && (elem.owned > 0));
    });
}

// Some attackers get a damage mod against some defenders
function getCasualtyMod(attacker,defender)
{
    // Cavalry take 50% more casualties vs infantry
    if ((defender.combatType == "cavalry") && (attacker.combatType == "infantry")) { return 1.50; }

    return 1.0; // Otherwise no modifier
}

function doFight(attacker,defender)
{
    if ((attacker.owned <= 0) || (defender.owned <= 0 )) { return; }

    // Defenses vary depending on whether the player is attacking or defending.
    var fortMod = (defender.alignment == "player" ? (civData.fortification.owned * civData.fortification.efficiency)
                                                  : (civData.efort.owned * civData.efort.efficiency));
    var palisadeMod = ((defender.alignment == "player")&&(civData.palisade.owned)) * civData.palisade.efficiency;

    // Determine casualties on each side.  Round fractional casualties
    // probabilistically, and don't inflict more than 100% casualties.
    var attackerCas = Math.min(attacker.owned,rndRound(getCasualtyMod(defender,attacker) * defender.owned * defender.efficiency));
    var defenderCas = Math.min(defender.owned,rndRound(getCasualtyMod(attacker,defender) * attacker.owned * (attacker.efficiency - palisadeMod) * Math.max(1 - fortMod, 0)));

    attacker.owned -= attackerCas;
    defender.owned -= defenderCas;

    // Give player credit for kills.
    var playerCredit = ((attacker.alignment == "player") ? defenderCas :
                        (defender.alignment == "player") ? attackerCas : 0);

    //Increments enemies slain, corpses, and piety
    curCiv.enemySlain.owned += playerCredit;
    if (civData.throne.owned) { civData.throne.count += playerCredit; }
    civData.corpses.owned += (attackerCas + defenderCas);
    if (civData.book.owned) { civData.piety.owned += (attackerCas + defenderCas) * 10; }

    //Updates population figures (including total population)
    updatePopulation();
}


function doSlaughter(attacker)
{
    var killVerb = (attacker.species == "animal") ? "eaten" : "killed";
    var target = randomHealthyWorker(); //Choose random worker
    if (target) { 
        // An attacker may disappear after killing
        if (Math.random() < attacker.killExhaustion) { --attacker.owned; }

        --civData[target].owned;

        if (attacker.species != "animal") { ++civData.corpses.owned; } // Animals will eat the corpse
        gameLog(civData[target].getQtyName(1) + " " + killVerb + " by " + attacker.getQtyName(attacker.owned));
    } else { // Attackers slowly leave once everyone is dead
        var leaving = Math.ceil(attacker.owned * Math.random() * attacker.killFatigue);
        attacker.owned -= leaving;
    }
    updatePopulation();
}

function doLoot(attacker)
{
    // Select random resource, steal random amount of it.
    var target = lootable[Math.floor(Math.random() * lootable.length)];
    var stolenQty = Math.floor((Math.random() * 1000)); //Steal up to 1000.
    stolenQty = Math.min(stolenQty,target.owned);
    if (stolenQty > 0) { gameLog(stolenQty + " " + target.getQtyName(stolenQty) 
                         + " stolen by " + attacker.getQtyName(attacker.owned)); }
    target.owned -= stolenQty;
    if (target.owned <= 0) {
        //some will leave
        var leaving = Math.ceil(attacker.owned * Math.random() * attacker.lootFatigue);
        attacker.owned -= leaving;
    }

    if (--attacker.owned < 0) { attacker.owned = 0; } // Attackers leave after stealing something.
    updateResourceTotals();
}

function doSack(attacker)
{
    //Destroy buildings
    var target = sackable[Math.floor(Math.random() * sackable.length)];

    // Slightly different phrasing for fortifications
    var destroyVerb = "burned";
    if (target == civData.fortification) { destroyVerb = "damaged"; } 

    if (target.owned > 0){
        --target.owned;
        ++civData.freeLand.owned;
        gameLog(target.getQtyName(1) + " " + destroyVerb + " by " + attacker.getQtyName(attacker.owned));
    } else {
        //some will leave
        var leaving = Math.ceil(attacker.owned * Math.random() * (1/112));
        attacker.owned -= leaving;
    }

    if (--attacker.owned < 0) { attacker.owned = 0; } // Attackers leave after sacking something.
    updateRequirements(target);
    updateResourceTotals();
    updatePopulation(); // Limits might change
}

function doHavoc(attacker)
{
    var havoc = Math.random(); //barbarians do different things
    if      (havoc < 0.3) { doSlaughter(attacker); } 
    else if (havoc < 0.6) { doLoot(attacker); } 
    else                  { doSack(attacker); }
}

function doShades()
{
    var defender = civData.shade;
    if (defender.owned <= 0) { return; }

    // Attack each enemy in turn.
    getCombatants(defender.place, "enemy").forEach(function(attacker) { 
        var num = Math.floor(Math.min((attacker.owned/4),defender.owned));
        //xxx Should we give book and throne credit here?
        defender.owned -= num;
        attacker.owned -= num;
    });

    // Shades fade away even if not killed.
    defender.owned = Math.max(Math.floor(defender.owned * 0.95), 0);
}

// Deals with potentially capturing enemy siege engines.
function doEsiege(siegeObj, targetObj)
{
    if (siegeObj.owned <= 0) { return; }

    //First check there are enemies there defending them
    if (!getCombatants( siegeObj.place,  siegeObj.alignment).length &&
         getCombatants(targetObj.place, targetObj.alignment).length)
    {
        //the siege engines are undefended; maybe capture them.
        if ((targetObj.alignment == "player") && civData.mathematics.owned){ //Can we use them?
            gameLog("Captured " + prettify(siegeObj.owned) + " enemy siege engines.");
            civData.siege.owned += siegeObj.owned; //capture them
        }
        siegeObj.owned = 0;
    }
    else if (doSiege(siegeObj, targetObj) > 0) {
        if (targetObj.id === "fortification") {
            updateRequirements(targetObj);
            gameLog("Enemy siege engine damaged our fortifications");
        }
    }
}

// Process siege engine attack.
// Returns the number of hits.
function doSiege(siegeObj, targetObj)
{
    var i, hit, hits = 0;
    // Only half can fire every round due to reloading time.
    // We also allow no more than 2 per defending fortification.
    var firing = Math.ceil(Math.min(siegeObj.owned/2,targetObj.owned*2));
    for (i = 0; i < firing; ++i){
        hit = Math.random();
        if (hit > 0.95) { --siegeObj.owned; } // misfire; destroys itself
        if (hit >= siegeObj.efficiency) { continue; } // miss
        ++hits; // hit
        if (--targetObj.owned <= 0) { break; }
    }

    return hits;
}


//Handling raids
function doRaid(place, attackerID, defenderID) {
    if (!curCiv.raid.raiding){ return; } // We're not raiding right now.

    var attackers = getCombatants(place, attackerID);
    var defenders = getCombatants(place, defenderID);

    if (attackers.length && !defenders.length) { // Win check.
        // Slaughter any losing noncombatant units.
        //xxx Should give throne and corpses for any human ones?
        unitData.filter(function(elem) { return ((elem.alignment == defenderID) && (elem.place == place)); })
          .forEach(function(elem) { elem.owned = 0; });

        if (!curCiv.raid.victory) { gameLog("Raid victorious!"); } // Notify player on initial win.
        curCiv.raid.victory = true;  // Flag victory for future handling
    }

    if (!attackers.length && defenders.length) { // Loss check.
        // Slaughter any losing noncombatant units.
        //xxx Should give throne and corpses for any human ones?
        unitData.filter(function(elem) { return ((elem.alignment == attackerID) && (elem.place == place)); })
          .forEach(function(elem) { elem.owned = 0; });

        gameLog("Raid defeated");  // Notify player
        resetRaiding();
        return;
    }

    // Do the actual combat.
    attackers.forEach(function(attacker) { 
        defenders.forEach(function(defender) { doFight(attacker,defender); }); // FIGHT!
    });

    // Handle siege engines
    doSiege(civData.siege, civData.efort);
}


function doLabourers() {
    if (curCiv.curWonder.stage !== 1) { return; }

    if (curCiv.curWonder.progress >= 100){
        //Wonder is finished! First, send workers home
        civData.unemployed.owned += civData.labourer.owned;
        civData.unemployed.ill += civData.labourer.ill;
        civData.labourer.owned = 0;
        civData.labourer.ill = 0;
        updatePopulation();
        //hide limited notice
        document.getElementById("lowResources").style.display = "none";
        //then set wonder.stage so things will be updated appropriately
        ++curCiv.curWonder.stage;
    } else {
        //we're still building
        
        // First, check our labourers and other resources to see if we're limited.
        var num = civData.labourer.owned;
        wonderResources.forEach( function(elem){ num = Math.min(num,elem.owned); });

        //remove resources
        wonderResources.forEach( function(elem){ elem.owned -= num; });

        //increase progress
        curCiv.curWonder.progress += num / (1000000 * getWonderCostMultiplier());
        
        //show/hide limited notice
        setElemDisplay("lowResources",(num < civData.labourer.owned));

        var lowItem = null;
        var i = 0;
        for (i=0;i < wonderResources.length;++i) { 
            if (wonderResources[i].owned < 1) { lowItem = wonderResources[i]; break; } 
        }
        if (lowItem) { document.getElementById("limited").innerHTML = " by low " + lowItem.getQtyName(); }
    }
    updateWonder();
}

function doMobs() {
    //Checks when mobs will attack
    //xxx Perhaps this should go after the mobs attack, so we give 1 turn's warning?
    var mobType, choose;
    if (population.current + curCiv.zombie.owned > 0) { ++curCiv.attackCounter; } // No attacks if deserted.
    if (population.current + curCiv.zombie.owned > 0 && curCiv.attackCounter > (60 * 5)){ //Minimum 5 minutes
        if (600*Math.random() < 1) {
            curCiv.attackCounter = 0;
            //Choose which kind of mob will attack
            mobType = "wolf"; // Default to wolves
            if (population.current + curCiv.zombie.owned >= 10000) {
                choose = Math.random();
                if      (choose > 0.5) { mobType = "barbarian"; } 
                else if (choose > 0.2) { mobType = "bandit"; }
            } else if (population.current + curCiv.zombie.owned >= 1000) {
                if (Math.random() > 0.5) { mobType = "bandit"; }
            }
            spawnMob(civData[mobType]);
        }
    }

    //Handling mob attacks
    getCombatants("home", "enemy").forEach(function(attacker) { 
        if (attacker.owned <= 0) { return; } // In case the last one was killed in an earlier iteration.

        var defenders = getCombatants(attacker.place,"player");
        if (!defenders.length) { attacker.onWin(); return; } // Undefended 

        defenders.forEach(function(defender) { doFight(attacker,defender); }); // FIGHT!
    });
}

function tickTraders() {
    //traders occasionally show up
    if (population.current + curCiv.zombie.owned > 0) { ++curCiv.trader.counter; }
    var delayMult = 60 * (3 - ((civData.currency.owned)+(civData.commerce.owned)));
    var check;
    if (population.current + curCiv.zombie.owned > 0 && curCiv.trader.counter > delayMult){
        check = Math.random() * delayMult;
        if (check < (1 + (0.2 * (civData.comfort.owned)))){
            curCiv.trader.counter = 0;
            tradeTimer();
        }
    }
    
    //Trader stuff
    if (curCiv.trader.timer > 0){
        if (--curCiv.trader.timer <= 0){
            setElemDisplay("tradeContainer",false);
        }
    }
}


function doPestControl() {
    //Decrements the pestControl Timer
    if (civData.pestControl.timer > 0) { --civData.pestControl.timer; }
}
    
function tickGlory() {
    //Handles the Glory bonus
    if (civData.glory.timer > 0){
        document.getElementById("gloryTimer").innerHTML = civData.glory.timer--;
    } else {
        document.getElementById("gloryGroup").style.display = "none";
    }
}
function doThrone() {
    if (civData.throne.count >= 100){
        //If sufficient enemies have been slain, build new temples for free
        civData.temple.owned += Math.floor(civData.throne.count/100);
        civData.throne.count = 0; //xxx This loses the leftovers.
        updateResourceTotals();
    }
}
    
function tickGrace() {
    if (civData.grace.cost > 1000) {
        civData.grace.cost = Math.floor(--civData.grace.cost);
        document.getElementById("graceCost").innerHTML = prettify(civData.grace.cost);
    }
}


// Start of init program code
function initCivclicker() {
    document.title = "CivClicker ("+versionData+")"; //xxx Not in XML DOM.

    addUITable(basicResources, "basicResources"); // Dynamically create the basic resource table.
    addUITable(homeBuildings, "buildings"); // Dynamically create the building controls table.
    addUITable(homeUnits, "jobs"); // Dynamically create the job controls table.
    addUITable(armyUnits, "party"); // Dynamically create the party controls table.
    addUpgradeRows(); // This sets up the framework for the upgrade items.
    addUITable(normalUpgrades, "upgrades"); // Place the stubs for most upgrades under the upgrades tab.
    addAchievementRows();
    addRaidRows();
    addWonderSelectText();
    makeDeitiesTables();

    if (!load("localStorage")) { //immediately attempts to load
        //Prompt player for names
        renameCiv();
        renameRuler();
    }
    updateSettings();
}
initCivclicker();

// This sets up the main game loop, which is scheduled to execute once per second.
console.log("running");
window.setInterval(function(){
    //debugging - mark beginning of loop execution
    //var start = new Date().getTime();
    
    tickAutosave();
    
    // Production workers do their thing.
    doFarmers();
    doWoodcutters();
    doMiners();
    doBlacksmiths();
    doTanners();
    doClerics();
    
    // Check for starvation
    doStarve();
    //xxx Need to kill workers who die from exposure.

    //Resources occasionally go above their caps.
    //Cull the excess /after/ other workers have taken their inputs.
    resourceData.forEach( function(elem){ if (elem.owned > elem.limit) { elem.owned = elem.limit; } });

    //Timers - routines that do not occur every second
    doMobs();
    doPestControl();
    tickGlory();
    doShades();
    doEsiege(civData.esiege, civData.fortification);
    doRaid("party","player","enemy");

    //Population-related
    doGraveyards();
    doHealers(); 
    doCorpses();
    doThrone();
    tickGrace();
    tickWalk();
    doLabourers();
    tickTraders();
    
    updateResourceTotals(); //This is the point where the page is updated with new resource totals
    testAchievements();
    
    //Data changes should be done; now update the UI.
    updateUpgrades();
    updateResourceRows(); //Update resource display
    updateBuildingButtons();
    updateJobButtons();
    updatePartyButtons();
    updatePopulationUI();
    updateTargets();
    updateDevotion();
    updateWonder();
    updateReset();
    
    //Debugging - mark end of main loop and calculate delta in milliseconds
    //var end = new Date().getTime();
    //var time = end - start;
    //console.log("Main loop execution time: " + time + "ms");
    
}, 1000); //updates once per second (1000 milliseconds)

/* UI functions */

// Called when user switches between the various panes on the left hand side of the interface
// Returns the target pane element.
function paneSelect(control){
    var i,oldTarget;

    // Identify the target pane to be activated, and the currently active
    // selector tab(s).
    var newTarget = dataset(control,"target");
    var selectors = document.getElementById("selectors");
    if (!selectors) { console.log("No selectors found"); return null; }
    var curSelects = selectors.getElementsByClassName("selected");

    // Deselect the old panels.
    for (i = 0; i < curSelects.length; ++i) { 
        oldTarget = dataset(curSelects[i],"target");
        if (oldTarget == newTarget) { continue; }
        document.getElementById(oldTarget).classList.remove("selected");
        curSelects[i].classList.remove("selected");
    }

    // Select the new panel.
    control.classList.add("selected");
    var targetElem = document.getElementById(newTarget);
    if (targetElem) { targetElem.classList.add("selected"); }
    return targetElem;
}

function impExp(){
    setElemDisplay("impexp"); // Toggles visibility state
}

function versionAlert(){
    console.log("New Version Available");
    document.getElementById("versionAlert").style.display = "inline";
}

function prettify(input){
    //xxx TODO: Add appropriate format options
    return (settings.delimiters) ? Number(input).toLocaleString() : input.toString();
}


function setAutosave(value){ 
    if (value !== undefined) { settings.autosave = value; } 
    document.getElementById("toggleAutosave").checked = settings.autosave;
}
function onToggleAutosave(control){ return setAutosave(control.checked); }

function setCustomQuantities(value){
    var i;
    var elems;
    var curPop = population.current + curCiv.zombie.owned;

    if (value !== undefined) { settings.customIncr = value; }
    document.getElementById("toggleCustomQuantities").checked = settings.customIncr;

    setElemDisplay("customJobQuantity",settings.customIncr);
    setElemDisplay("customPartyQuantity",settings.customIncr);
    setElemDisplay("customBuildQuantity",settings.customIncr);
    setElemDisplay("customSpawnQuantity",settings.customIncr);

    elems = document.getElementsByClassName("unit10");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 10)); }

    elems = document.getElementsByClassName("unit100");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 100)); }

    elems = document.getElementsByClassName("unit1000");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 1000)); }

    elems = document.getElementsByClassName("unitInfinity");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 1000)); }

    elems = document.getElementsByClassName("building10");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 100)); }

    elems = document.getElementsByClassName("building100");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 1000)); }

    elems = document.getElementsByClassName("building1000");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 10000)); }

    elems = document.getElementsByClassName("buildingInfinity");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],!settings.customIncr && (curPop >= 10000)); }

    elems = document.getElementsByClassName("buycustom");
    for (i = 0; i < elems.length; ++i) { setElemDisplay(elems[i],settings.customIncr); }
}
function onToggleCustomQuantities(control){ return setCustomQuantities(control.checked); }

// Toggles the display of the .notes class
function setNotes(value){
    if (value !== undefined) { settings.notes = value; }
    document.getElementById("toggleNotes").checked = settings.notes;

    var i;
    var elems = document.getElementsByClassName("note");
    for(i = 0; i < elems.length; ++i) {
        setElemDisplay(elems[i],settings.notes);
    }
}
function onToggleNotes(control){ return setNotes(control.checked); }

// value is the desired change in 0.1em units.
function textSize(value){
    if (value !== undefined) { settings.fontSize += 0.1 * value; }
    document.getElementById("smallerText").disabled = (settings.fontSize <= 0.5); 

    //xxx Should this be applied to the document instead of the body?
    body.style.fontSize = settings.fontSize + "em";
}

function setShadow(value){
    if (value !== undefined) { settings.textShadow = value; }
    document.getElementById("toggleShadow").checked = settings.textShadow;
    var shadowStyle = "3px 0 0 #fff, -3px 0 0 #fff, 0 3px 0 #fff, 0 -3px 0 #fff"
                    + ", 2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff";
    body.style.textShadow = settings.textShadow ? shadowStyle : "none";
}
function onToggleShadow(control){ return setShadow(control.checked); }

// Does nothing yet, will probably toggle display for "icon" and "word" classes 
// as that's probably the simplest way to do this.
function setIcons(value){ 
    if (value !== undefined) { settings.useIcons = value; } 
    document.getElementById("toggleIcons").checked = settings.useIcons;

    var i;
    var elems = document.getElementsByClassName("icon");
    for(i = 0; i < elems.length; ++i) {
        // Worksafe implies no icons.
        elems[i].style.visibility = (settings.useIcons && !settings.worksafe) ? "visible" : "hidden";
    }
}
function onToggleIcons(control){ return setIcons(control.checked); }

function setDelimiters(value){
    if (value !== undefined) { settings.delimiters = value; }
    document.getElementById("toggleDelimiters").checked = settings.delimiters;
    updateResourceTotals();
}
function onToggleDelimiters(control){ return setDelimiters(control.checked); }

function setWorksafe(value){
    if (value !== undefined) { settings.worksafe = value; }
    document.getElementById("toggleWorksafe").checked = settings.worksafe;

    //xxx Should this be applied to the document instead of the body?
    if (settings.worksafe){
        body.classList.remove("hasBackground");
    } else {
        body.classList.add("hasBackground");
    }

    setIcons(); // Worksafe overrides icon settings.
}
function onToggleWorksafe(control){ return setWorksafe(control.checked); }


/* Debug functions */

//Not strictly a debug function so much as it is letting the user know when 
//something happens without needing to watch the console.
function gameLog(message){
    //get the current date, extract the current time in HH.MM format
    //xxx It would be nice to use Date.getLocaleTimeString(locale,options) here, but most browsers don't allow the options yet.
    var d = new Date();
    var curTime = d.getHours() + "." + ((d.getMinutes() < 10) ? "0": "") + d.getMinutes();

    //Check to see if the last message was the same as this one, if so just increment the (xNumber) value
    if (document.getElementById("logL").innerHTML != message) {
        logRepeat = 0; //Reset the (xNumber) value

        //Go through all the logs in order, moving them down one and successively overwriting them.
        var i = 5; // Number of lines of log to keep.
        while (--i > 1) { document.getElementById("log"+i).innerHTML = document.getElementById("log"+(i-1)).innerHTML; }
        //Since ids need to be unique, log1 strips the ids from the log0 elements when copying the contents.
        document.getElementById("log1").innerHTML = "<td>" + document.getElementById("logT").innerHTML 
          + "</td><td>" + document.getElementById("logL").innerHTML 
          + "</td><td>" + document.getElementById("logR").innerHTML + "</td>";
    }
    // Updates most recent line with new time, message, and xNumber.
    var s =  "<td id='logT'>" + curTime + "</td><td id='logL'>" + message + "</td><td id='logR'>";
    if (++logRepeat > 1) { s += "(x" + logRepeat + ")"; } // Optional (xNumber)
    s += "</td>";
    document.getElementById("log0").innerHTML = s;
}

function updateTest(){
    //Debug function, runs the update() function 1000 times, adds the results together, and calculates a mean
    var total = 0;
    var i;
    for (i=0;i<1000;i++){
        total += update();
    }
    console.log(total);
    total = total / 1000;
    console.log(total);
}

function ruinFun(){
    //Debug function adds loads of stuff for free to help with testing.
    civData.food.owned += 1000000;
    civData.wood.owned += 1000000;
    civData.stone.owned += 1000000;
    civData.barn.owned += 5000;
    civData.woodstock.owned += 5000;
    civData.stonestock.owned += 5000;
    civData.herbs.owned += 1000000;
    civData.skins.owned += 1000000;
    civData.ore.owned += 1000000;
    civData.leather.owned += 1000000;
    civData.metal.owned += 1000000;
    civData.piety.owned += 1000000;
    civData.gold.owned += 10000;
    renameRuler("Cheater");
    updatePopulation();
    updateUpgrades();
    updateResourceTotals();
}

/*
 * If you're reading this, thanks for playing!
 * This project was my first major HTML5/Javascript game, and was as
 * much about learning Javascript as it is anything else. I hope it
 * inspires others to make better games. :)
 *
 *     David Holley
 */
