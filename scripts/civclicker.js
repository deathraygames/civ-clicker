"use strict";
/**
	CivClicker
	Copyright (C) 2014; see the README.md file for authorship.

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

var setup = {};
var loopTimer = 0;

// TODO: Update the version numbering internally
var version = 19; // This is an ordinal used to trigger reloads.
var versionData = new VersionData(1,1,59,"alpha"); // this is not accurate

var saveTag = "civ";
var saveTag2 = saveTag + "2"; // For old saves.
var saveSettingsTag = "civSettings";
var logRepeat = 1;

// Civ size category minimums
var civSizes = [
	{ min_pop :      0, name: "Thorp"       , id : "thorp"      },
	{ min_pop :     20, name: "Hamlet"      , id : "hamlet"     },
	{ min_pop :     60, name: "Village"     , id : "village"    },
	{ min_pop :    200, name: "Small Town"  , id : "smallTown"  },
	{ min_pop :   2000, name: "Large Town"  , id : "largeTown"  },
	{ min_pop :   5000, name: "Small City"  , id : "smallCity"  },
	{ min_pop :  10000, name: "Large City"  , id : "largeCity"  },
	{ min_pop :  20000, name:"Metro&shy;polis",id : "metropolis" },
	{ min_pop :  50000, name: "Small Nation", id : "smallNation"},
	{ min_pop : 100000, name: "Nation"      , id : "nation"     },
	{ min_pop : 200000, name: "Large Nation", id : "largeNation"},
	{ min_pop : 500000, name: "Empire"      , id : "empire"     }
];

var PATIENT_LIST = [
	"healer","cleric","farmer","soldier","cavalry","labourer",
	"woodcutter","miner","tanner","blacksmith","unemployed"
];

// Declare variables here so they can be referenced later.  
var curCiv = {
	civName: "Woodstock",
	rulerName: "Orteil",

	zombie: { owned:0 },
	grave: { owned:0 },
	enemySlain: { owned:0 },
	morale: { 
		mod: 		1.0,
		efficiency: 1.0
	},

	resourceClicks : 0, // For NeverClick
	attackCounter : 0, // How long since last attack?

	trader : {
		materialId: "",
		requested: 	0,
		timer: 		0, // How many seconds will the trader be around
		counter: 	0 // How long since last trader?
	},

	raid: {
		raiding: false, // Are we in a raid right now?
		victory: false, // Are we in a "raid succeeded" (Plunder-enabled) state right now?
		epop: 0,  // Population of enemy we're raiding.
		plunderLoot: {}, // Loot we get if we win.
		last: "",
		targetMax: civSizes[0].id // Largest target allowed
	},

	curWonder: {
		name: "",
		stage: 0, // 0 = Not started, 1 = Building, 2 = Built, awaiting selection, 3 = Finished.
		progress: 0, // Percentage completed.
		rushed: false
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

// These are not saved, but we need them up here for the asset data to init properly.
var population = {
	current:	0,
	living:		0,
	zombie:		0,
	limit:		0,
	healthy:	0,
	totalSick:	0,
	extra: 		0
};

// Caches the total number of each wonder, so that we don't have to recount repeatedly.
var wonderCount = {};

var civData = getCivData(); // Giant array of data, defined in "data" js

// Build a variety of additional indices so that we can iterate over specific
// subsets of our civ objects.
var resourceData	= []; // All resources
var buildingData	= []; // All buildings
var upgradeData 	= []; // All upgrades
var powerData 		= []; // All 'powers' //xxx This needs refinement.
var unitData 		= []; // All units
var achData 		= []; // All achievements
var sackable		= []; // All buildings that can be destroyed
var lootable		= []; // All resources that can be stolen
var killable		= []; // All units that can be destroyed
var homeBuildings	= []; // All buildings to be displayed in the home area
var homeUnits		= []; // All units to be displayed in the home area
var armyUnits		= []; // All units to be displayed in the army area
var basicResources	= []; // All basic (click-to-get) resources
var normalUpgrades	= []; // All upgrades to be listed in the normal upgrades area

// The resources that Wonders consume, and can give bonuses for.
var wonderResources = getWonderResources(civData); // defined in "data" js

// These are settings that should probably be tied to the browser.
var settings = {
	autosave: 			true,
	autosaveCounter: 	1,
	autosaveTime: 		60, //Currently autosave is every minute. Might change to 5 mins in future.
	customIncr: 		false,
	fontSize: 			1.0,
	delimiters: 		true,
	textShadow: 		false,
	notes: 				true,
	worksafe: 			false,
	useIcons: 			true
};


function setIndexArrays (civData) {
	civData.forEach(function(elem){ 
		if (!(elem instanceof CivObj)) { 
			console.error("Unknown type:", elem);
			return; 
		}
		if (elem.type == "resource") { 
			resourceData.push(elem); 
			if (elem.vulnerable === true) { 
				lootable.push(elem); 
			}
			if (elem.subType == "basic") { 
				basicResources.push(elem); 
			} 
		} 
		if (elem.type == "building") { 
			buildingData.push(elem); 
			if (elem.vulnerable === true) { sackable.push(elem); }
			if (elem.subType == "normal" || elem.subType == "land") { homeBuildings.push(elem); } 
		}
		if (elem.subType == "prayer") { 
			powerData.push(elem); 
		} else if (elem.type == "upgrade") { 
			upgradeData.push(elem); 
			if (elem.subType == "upgrade") { 
				normalUpgrades.push(elem); 
			} 
		}
		if (elem.type == "unit") { 
			unitData.push(elem); 
			if (elem.vulnerable === true) { killable.push(elem); }
			if (elem.place == "home") { homeUnits.push(elem); }
			if (elem.place == "party") { armyUnits.push(elem); } 
		}
		if (elem.type == "achievement") { 
			achData.push(elem); 
		}
	});
}


function calculatePopulation () {

	population = {
		current:	0,
		living:		0,
		zombie:		curCiv.zombie.owned,
		limit:		0,
		limitIncludingUndead: 0,
		healthy:	0,
		totalSick:	0,
		extra: 		0
	};

	//Update population limit by multiplying out housing numbers
	population.limit = (
		civData.tent.owned 
		+ (civData.hut.owned * 3) 
		+ (civData.cottage.owned * 6) 
		+ (civData.house.owned * (10 + ((civData.tenements.owned) * 2) + ((civData.slums.owned) * 2))) 
		+ (civData.mansion.owned * 50)
	);
	population.limitIncludingUndead = population.limit + population.zombie;

	//Update sick workers
	unitData.forEach(function(unit) { 
		if (unit.isPopulation) { // has to be a player, non-special, non-mechanical
			population.current += unit.owned;
			
			if (unit.vulnerable) {
				// TODO Should this use 'killable'?
				population.healthy += unit.owned;
			}
			if (unit.ill) {
				population.totalSick += (unit.ill||0);
			} else {
				population.healthy += 1; // TODO: Not sure if this is calculated right
			}
		} else {
			population.extra += unit.owned;
		}
	});
	// Calculate housed/fed population (excludes zombies)
	population.living = Math.max(0, population.current - population.zombie);
	// Calculate healthy workers (should exclude sick, zombies and deployed units)
	// TODO: Doesn't subtracting the zombies here throw off the calculations in randomHealthyWorker()?
	population.healthy = Math.max(0, population.healthy - population.zombie);

	//Zombie soldiers dying can drive population.current negative if they are 
	// killed and zombies are the only thing left.
	// TODO: This seems like a hack that should be given a real fix.
	if (population.current < 0){
		if (curCiv.zombie.owned > 0){
			//This fixes that by removing zombies and setting to zero.
			curCiv.zombie.owned += population.current;
			population.current = 0;
		} else {
			console.warn("Warning: Negative current population detected.");
		}
	}	
}


function getCivType () {
	var civType = civSizes.getCivSize(population.living).name;
	if (population.living === 0 && population.limit >= 1000){
		civType = "Ghost Town";
	}
	if (population.zombie >= 1000 && population.zombie >= 2 * population.living){ //easter egg
		civType = "Necropolis";
	}
	return civType;
}



function getCurDeityDomain() { 
	return (curCiv.deities.length > 0) ? curCiv.deities[0].domain : undefined; 
}



// Tallies the number of each wonder from the wonders array.
function tallyWonderCount() {
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



function playerCombatMods() { 
	return (0.01 * ((civData.riddle.owned) + (civData.weaponry.owned) + (civData.shields.owned))); 
}

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
function canPurchase (purchaseObj, qty) {
	if (!purchaseObj) { return 0; }
	if (qty === undefined) { qty = Infinity; } // Default to as many as we can.
	if (qty === false) { qty = -1; } // Selling back a boolean item.

	// Can't buy if we don't meet the prereqs.
	if (!meetsPrereqs(purchaseObj.prereqs)) { 
		qty = Math.min(qty, 0); 
	}

	// Can't sell more than we have (if salable at all)
	qty = Math.max(qty, -(purchaseObj.salable ? purchaseObj.owned : 0));

	// If this is a relocation, can't shift more than our source pool.
	if (purchaseObj.source) { 
		qty = Math.min(qty, civData[purchaseObj.source].owned); 
	}

	// If this is a destination item, it's just a relocation of an existing
	// item, so we ignore purchase limits.  Otherwise we check them.
	if (purchaseObj.isDest && !purchaseObj.isDest()) { 
		qty = Math.min(qty, purchaseObj.limit - purchaseObj.total); 
	}

	// See if we can afford them; return fewer if we can't afford them all
	return Math.min(qty, canAfford(purchaseObj.require));
}

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
	var s = (
		'<tr id="'+ objId + 'Row" class="purchaseRow" data-target="'+ objId + '">'
		+ '<td>'
		+ '<img src="images/'+objId+'.png" class="icon icon-lg" alt="'+objName+'"/>'
		+ '<button data-action="increment">' + purchaseObj.verb + '</button>'
		+ '<label>' + objName + ':</label>'
		+ '</td>'
		+ '<td class="number mainNumber"><span data-action="display">.</span></td>'
		+ '<td class="number maxNumber">/ max: <span id="max'+objId+'">...</span></td>'
		+ '<td class="number net"><span data-action="displayNet">..</span>/s</td>'
		+ '</tr>'
	);
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
function getPurchaseRowText (purchaseObj) {
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
function onBulkEvent(e) {
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
	civObjs.forEach(function(elem) { 
		s += elem.type == "resource" ? getResourceRowText(elem) 
				: elem.type == "upgrade"  ? getUpgradeRowText(elem) 
					: getPurchaseRowText(elem); 
	});
	var groupElem = document.getElementById(groupElemName);
	groupElem.innerHTML += s;
	groupElem.onmousedown = onBulkEvent;
	return groupElem;
}


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
	ui.find("#upgradesPane").innerHTML += 
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

	ui.find("#purchasedUpgrades").innerHTML += standardUpgStr;
	ui.find("#purchasedPantheon").innerHTML = pantheonUpgStr;
}

function getLandTotals () {
	//Update land values
	var ret = { lands: 0, buildings: 0, free: 0 };
	buildingData.forEach(function(elem) { 
		if (elem.subType == "land") { ret.free     += elem.owned; }
		else                        { ret.buildings += elem.owned; }
	});
	ret.lands = ret.free + ret.buildings;
	return ret;
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
	ui.find("#activeDeity").innerHTML = '<tr id="' + deityId + '">'
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
	ui.find("#oldDeities").innerHTML = s;

	updateDeity();
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

function setDefaultSettings(){
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

// Game functions

//This function is called every time a player clicks on a primary resource button
function increment (objId) {
	var purchaseObj = civData[objId];
	var numArmy = 0;

	if (!purchaseObj) { console.log("Unknown purchase: "+objId); return; }

	unitData.forEach(function(elem) { 
		if ((elem.alignment == "player")&&(elem.species=="human")
										&&(elem.combatType)&&(elem.place == "home")) { 
			numArmy += elem.owned; 
		} 
	}); // Nationalism adds military units.

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

	ui.find("#clicks").innerHTML = prettify(Math.round(++curCiv.resourceClicks));
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

	// If building, then you use up free land
	if (purchaseObj.type == "building") {
		civData.freeLand.owned -= num;
		// check for overcrowding
		if (civData.freeLand.owned < 0) {
			gameLog("You are suffering from overcrowding.");  // I18N
			adjustMorale(Math.max(num,-civData.freeLand.owned) * -0.0025 * (civData.codeoflaws.owned ? 0.5 : 1.0));
		}
	}

	updateRequirements(purchaseObj); //Increases buildings' costs
	updateResourceTotals(); //Update page with lower resource values and higher building total
	updatePopulation(); //Updates the army display
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
	if (curPop === undefined) { 
		curPop = population.living;
	}
	return (20*num) + calcArithSum(0.01, curPop, curPop + num);
}
function calcZombieCost(num){ 
	return calcWorkerCost(num, population.zombie)/5; 
}



// Create a cat
function spawnCat() {
	++civData.cat.owned;
	gameLog("Found a cat!");
}

// Creates or destroys workers
function spawn(num){
	var newJobId = "unemployed";
	var bums = civData.unemployed;
	if (num == "custom" ) { num =  getCustomNumber(bums); }
	if (num == "-custom") { num = -getCustomNumber(bums); }

	// Find the most workers we can spawn
	num = Math.max(num, -bums.owned);  // Cap firing by # in that job.
	num = Math.min(num,logSearchFn(calcWorkerCost,civData.food.owned));

	// Apply population limit, and only allow whole workers.
	num = Math.min(num, (population.limit - population.living));

	// Update numbers and resource levels
	civData.food.owned -= calcWorkerCost(num);

	// New workers enter as a job that has been selected, but we only destroy idle ones.
	newJobId = ui.find("#newSpawnJobSelection").value;
	if (num >= 0 && typeof civData[newJobId] === "object") {
		civData[newJobId].owned += num;
	} else { 
		bums.owned += num; 
	}
	calculatePopulation(); //Run through the population->job update cycle

	//This is intentionally independent of the number of workers spawned
	if (Math.random() * 100 < 1 + (civData.lure.owned)) { spawnCat(); }

	updateResourceTotals(); //update with new resource number
	updatePopulation();
	
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
function starve (num) {
	var targetObj,i;
	var starveCount = 0;
	if (num === undefined) { num = 1; }
	num = Math.min(num, population.living);

	for (i=0; i<num; ++i) {
		starveCount += killUnit(pickStarveTarget());
	}
	return starveCount;
}

function doStarve() {
	var corpsesEaten, numberStarve;
	if (civData.food.owned < 0 && civData.waste.owned) // Workers eat corpses if needed
	{
		corpsesEaten = Math.min(civData.corpses.owned, -civData.food.owned);
		civData.corpses.owned -= corpsesEaten;
		civData.food.owned += corpsesEaten;
	}

	if (civData.food.owned < 0) { // starve if there's not enough food.
		//xxx This is very kind.  Only 0.1% deaths no matter how big the shortage?
		numberStarve = starve(Math.ceil(population.living/1000));
		if (numberStarve == 1) { 
			gameLog("A citizen starved to death"); 
		} else if (numberStarve > 1) { 
			gameLog(prettify(numberStarve) + " citizens starved to death"); 
		}
		adjustMorale(-0.01);
		civData.food.owned = 0;
	}
}

function killUnit (unit) {
	var killed = 0;
	if (!unit) { return 0; }

	if (unit.ill) { unit.ill -= 1; }
	else          { unit.owned -= 1; }
	
	civData.corpses.owned += 1; //Increments corpse number
	//Workers dying may trigger Book of the Dead
	if (civData.book.owned) { civData.piety.owned += 10; }
	calculatePopulation();
	return 1;
};


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
	num = Math.min(num, logSearchFn(calcZombieCost,civData.piety.owned));

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

	calculatePopulation(); //Run through population->jobs cycle to update page with zombie and corpse totals
	updatePopulation();
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

	makeDeitiesTables();
	updateUpgrades();
}

function digGraves(num){
	//Creates new unfilled graves.
	curCiv.grave.owned += 100 * num;
	updatePopulation(); //Update page with grave numbers
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
	calculatePopulation(); //Removes killed worker

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
	updatePopulation();
}

function walk(increment){
	if (increment === undefined) { increment = 1; }
	if (increment === false) { increment = 0; civData.walk.rate = 0; }

	civData.walk.rate += increment;

	//xxx This needs to move into the main loop in case it's reloaded.
	ui.find("#walkStat").innerHTML = prettify(civData.walk.rate);
	ui.find("#ceaseWalk").disabled = (civData.walk.rate === 0);
	ui.show("#walkGroup",(civData.walk.rate > 0)); 
}

function tickWalk() {
	var i;
	var target = "";
	if (civData.walk.rate > population.healthy) { 
		civData.walk.rate = population.healthy; 
		ui.find("#ceaseWalk").disabled = true;
	}
	if (civData.walk.rate <= 0) { return; }

	for (i=0;i<civData.walk.rate;++i){
		target = randomHealthyWorker(); //xxx Need to modify this to do them all at once.
		if (!target){ break; } 
		--civData[target].owned;
	}
	updatePopulation(true);
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
		ui.find("#iconoclasm").disabled = true;
		var append = "<br />";
		for (i=1;i<curCiv.deities.length;++i){
			append += '<button onclick="iconoclasm(' + i + ')">';
			append += curCiv.deities[i].name;
			append += '</button><br />';
		}
		append += '<br /><button onclick=\'iconoclasm("cancel")\'>Cancel</button>';
		ui.find("#iconoclasmList").innerHTML = append;
	}
}

function iconoclasm(index){
	//will splice a deity from the deities array unless the user has cancelled
	ui.find("#iconoclasmList").innerHTML = "";
	ui.find("#iconoclasm").disabled = false;
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
		var max_mob = (population.current / 50);
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
	curCiv.raid.plunderLoot = { 
		freeLand: Math.round(baseLoot * (1 + (civData.administration.owned))) 
	};
	lootable.forEach(function(elem){ curCiv.raid.plunderLoot[elem.id] = Math.round(baseLoot * Math.random()); });

	ui.hide("#raidNews");
	updateTargets(); //Hides raid buttons until the raid is finished
	updatePartyButtons(); 
}
function onInvade(control) { return invade(dataset(control,"target")); }

function plunder () {
	var plunderMsg = "";
	var raidNewsElt = ui.find("#raidNews");

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

	ui.show(raidNewsElt, true);
	raidNewsElt.innerHTML = "Results of last raid: " + plunderMsg;

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
	ui.find("#gloryTimer").innerHTML = civData.glory.timer; //update timer to player
	ui.find("#gloryGroup").style.display = "block";
}

function grace(delta){
	if (delta === undefined) { delta = 0.1; }
	if (civData.piety.owned >= civData.grace.cost){
		civData.piety.owned -= civData.grace.cost;
		civData.grace.cost = Math.floor(civData.grace.cost * 1.2);
		ui.find("#graceCost").innerHTML = prettify(civData.grace.cost);
		adjustMorale(delta);
		updateResourceTotals();
		updateMorale();
	}
}

//xxx Eventually, we should have events like deaths affect morale (scaled by %age of total pop)
function adjustMorale(delta) {
	//Changes and updates morale given a delta value
	if (delta > 1000) {
		//console.warn("Cannot adjust morale by so much", delta);
		return;
	}
	if (population.current > 0) { //dividing by zero is bad for hive
		//calculates zombie proportion (zombies do not become happy or sad)
		var fraction = population.living / population.current;
		var max = 1 + (0.5 * fraction);
		var min = 1 - (0.5 * fraction);
		//alters morale
		curCiv.morale.efficiency += delta * fraction;
		//Then check limits (50 is median, limits are max 0 or 100, but moderated by fraction of zombies)
		if (curCiv.morale.efficiency > max){
			curCiv.morale.efficiency = max;
		} else if (curCiv.morale.efficiency < min){
			curCiv.morale.efficiency = min;
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
	var wp = ui.find("#wonderNameP");
	if (wp) { wp.innerHTML = curCiv.curWonder.name; }
	var wc = ui.find("#wonderNameC");
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

function startTrader(){
	// Set timer length (12 sec + 5 sec/upgrade)
	curCiv.trader.timer = 12 + (5 * (civData.currency.owned + civData.commerce.owned + civData.stay.owned));

	//then set material and requested amount
	var tradeItems = [ // Item and base amount
		{ materialId: "food",    requested: 5000 },
		{ materialId: "wood",    requested: 5000 },
		{ materialId: "stone",   requested: 5000 },
		{ materialId: "skins",   requested:  500 },
		{ materialId: "herbs",   requested:  500 },
		{ materialId: "ore",     requested:  500 },
		{ materialId: "leather", requested:  250 },
		{ materialId: "metal",   requested:  250 }
	];

	// Randomly select and merge one of the above.
	var selected = tradeItems[Math.floor(Math.random() * tradeItems.length)];
	curCiv.trader.materialId = selected.materialId;
	curCiv.trader.requested = selected.requested * (Math.ceil(Math.random() * 20)); // Up to 20x amount

	updateTrader();
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

function isTraderHere () {
	return (curCiv.trader.timer > 0);
}

function buy (materialId){
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
	console.error(err.toString());
	console.error(msg);
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
function load (loadType) {
	//define load variables
	var loadVar = {},
		loadVar2 = {},
		settingsVar = {};
	var saveVersion = new VersionData(1,0,0,"legacy");

	if (loadType === "cookie") {
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
	
	if (loadType === "localStorage") {
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
	
	if (loadType === "import") {
		loadVar = importByInput(ui.find("#impexpField"));
	}

	saveVersion = mergeObj(saveVersion, loadVar.versionData);
	if (saveVersion.toNumber() > versionData.toNumber()) {
		// Refuse to load saved games from future versions.
		var alertStr = "Cannot load; saved game version " + saveVersion + " is newer than game version " + versionData;
		console.log(alertStr);
		alert(alertStr);
		return false;
	} 
	if (saveVersion.toNumber() < versionData.toNumber()) {
		// Migrate saved game data from older versions.
		var settingsVarReturn = { val: {} };
		migrateGameData(loadVar, settingsVarReturn);
		settingsVar = settingsVarReturn.val;

		// Merge the loaded data into our own, in case we've added fields.
		mergeObj(curCiv, loadVar.curCiv);
	} else {
		curCiv = loadVar.curCiv; // No need to merge if the versions match; this is quicker.
	}

	console.log("Loaded save game version " + saveVersion.major +
		"." + saveVersion.minor + "." + saveVersion.sub + "(" + saveVersion.mod + ") via", loadType);

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
	tallyWonderCount();
	ui.find("#clicks").innerHTML = prettify(Math.round(curCiv.resourceClicks));
	ui.find("#civName").innerHTML = curCiv.civName;
	ui.find("#rulerName").innerHTML = curCiv.rulerName;
	ui.find("#wonderNameP").innerHTML = curCiv.curWonder.name;
	ui.find("#wonderNameC").innerHTML = curCiv.curWonder.name;

	return true;
}

function importByInput (elt) {
	//take the import string, decompress and parse it
	var compressed = elt.value;
	var decompressed = LZString.decompressFromBase64(compressed);
	var revived = JSON.parse(decompressed);
	//set variables to load from
	var loadVar = revived[0];
	var loadVar2;
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
	return loadVar;
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
		ui.find("#impexpField").value = compressed;
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

	return true;
}

function deleteSave(){
	//Deletes the current savegame by setting the game's cookies to expire in the past.
	if (!confirm("All progress and achievements will be lost.\nReally delete save?")) { return; } //Check the player really wanted to do that.

	try {
		deleteCookie(saveTag);
		deleteCookie(saveTag2);
		localStorage.removeItem(saveTag);
		localStorage.removeItem(saveTag2);
		localStorage.removeItem(saveSettingsTag);
		gameLog("Save Deleted");
		if (confirm("Save Deleted. Refresh page to start over?")) {
			window.location.reload();
		}
	} catch(err) {
		handleStorageError(err);
		alert("Save Deletion Failed!");
	}
}

function renameCiv(newName){
	//Prompts player, uses result as new civName
	while (!newName) {
		newName = prompt("Please name your civilization",(newName || curCiv.civName || "Woodstock"));
		if ((newName === null)&&(curCiv.civName)) { return; } // Cancelled
	}

	curCiv.civName = newName;
	ui.find("#civName").innerHTML = curCiv.civName;
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

	ui.find("#rulerName").innerHTML = curCiv.rulerName;
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
	console.log("Reset");
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
	curCiv.morale = { mod: 1.0, efficiency: 1.0 };

	// If our current deity is powerless, delete it.
	if (!curCiv.deities[0].maxDev) {
		curCiv.deities.shift();
	}
	// Insert space for a fresh deity.
	curCiv.deities.unshift({ name:"", domain:"", maxDev:0 });

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

	updateAfterReset();
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

// TODO: Need to improve 'net' handling.
function doFarmers() {
	var specialChance = civData.food.specialChance + (0.1 * civData.flensing.owned);
	var millMod = 1;
	if (population.current > 0) { 
		millMod = population.living / population.current; 
	}
	civData.food.net = (
		civData.farmer.owned 
		* (1 + (civData.farmer.efficiency * curCiv.morale.efficiency)) 
		* ((civData.pestControl.timer > 0) ? 1.01 : 1) 
		* getWonderBonus(civData.food) 
		* (1 + civData.walk.rate/120) 
		* (1 + civData.mill.owned * millMod / 200) //Farmers farm food
	);
	civData.food.net -= population.living; //The living population eats food.
	civData.food.owned += civData.food.net;
	if (civData.skinning.owned && civData.farmer.owned > 0){ //and sometimes get skins
		var skinsChance = specialChance * (civData.food.increment + ((civData.butchering.owned) * civData.farmer.owned / 15.0)) * getWonderBonus(civData.skins);
		var skinsEarned = rndRound(skinsChance);
		civData.skins.net += skinsEarned;
		civData.skins.owned += skinsEarned;
	}
}
function doWoodcutters() {
	civData.wood.net = civData.woodcutter.owned * (civData.woodcutter.efficiency * curCiv.morale.efficiency) * getWonderBonus(civData.wood); //Woodcutters cut wood
	civData.wood.owned += civData.wood.net;
	if (civData.harvesting.owned && civData.woodcutter.owned > 0){ //and sometimes get herbs
		var herbsChance = civData.wood.specialChance * (civData.wood.increment + ((civData.gardening.owned) * civData.woodcutter.owned / 5.0)) * getWonderBonus(civData.herbs);
		var herbsEarned = rndRound(herbsChance);
		civData.herbs.net += herbsEarned;
		civData.herbs.owned += herbsEarned;
	}
}

function doMiners() {
	var specialChance = civData.stone.specialChance + (civData.macerating.owned ? 0.1 : 0);
	civData.stone.net = civData.miner.owned * (civData.miner.efficiency * curCiv.morale.efficiency) * getWonderBonus(civData.stone); //Miners mine stone
	civData.stone.owned += civData.stone.net;
	if (civData.prospecting.owned && civData.miner.owned > 0){ //and sometimes get ore
		var oreChance = specialChance * (civData.stone.increment + ((civData.extraction.owned) * civData.miner.owned / 5.0)) * getWonderBonus(civData.ore);
		var oreEarned = rndRound(oreChance);
		civData.ore.net += oreEarned;
		civData.ore.owned += oreEarned;
	}
}

function doBlacksmiths() {
	var oreUsed = Math.min(civData.ore.owned, (civData.blacksmith.owned * civData.blacksmith.efficiency * curCiv.morale.efficiency));
	var metalEarned = oreUsed * getWonderBonus(civData.metal);
	civData.ore.net -= oreUsed;
	civData.ore.owned -= oreUsed;
	civData.metal.net += metalEarned;
	civData.metal.owned += metalEarned;
}

function doTanners() {
	var skinsUsed = Math.min(civData.skins.owned, (civData.tanner.owned * civData.tanner.efficiency * curCiv.morale.efficiency));
	var leatherEarned = skinsUsed * getWonderBonus(civData.leather);
	civData.skins.net -= skinsUsed;
	civData.skins.owned -= skinsUsed;
	civData.leather.net += leatherEarned;
	civData.leather.owned += leatherEarned;
}

function doClerics() {
	var pietyEarned = (
		civData.cleric.owned 
		* (civData.cleric.efficiency + (civData.cleric.efficiency * (civData.writing.owned))) 
		* (1 + ((civData.secrets.owned) 
		* (1 - 100/(civData.graveyard.owned + 100)))) 
		* curCiv.morale.efficiency 
		* getWonderBonus(civData.piety)
	);
	civData.piety.net += pietyEarned;
	civData.piety.owned += pietyEarned;
}
// Try to heal the specified number of people in the specified job
// Makes them sick if the number is negative.
function healByJob(job,num)
{
	if (!isValid(job) || !job) { return 0; }
	if (num === undefined) { num = 1; } // default to 1
	num = Math.min(num,civData[job].ill);
	num = Math.max(num,-civData[job].owned);
	civData[job].ill -= num;
	civData[job].owned += num;

	calculatePopulation();

	return num;
}

//Selects random workers, transfers them to their Ill variants
function spreadPlague(sickNum){
	var actualNum = 0;
	var i;

	calculatePopulation();
	// Apply in 1-worker groups to spread it out.
	for (i=0; i<sickNum; i++){ 
		actualNum += -healByJob(randomHealthyWorker(),-1); 
	}

	return actualNum;
}

// Select a sick worker type to cure, with certain priorities
function getNextPatient () { 
	var i;
	for (i=0; i < PATIENT_LIST.length; ++i) {
		if (civData[PATIENT_LIST[i]].ill > 0) { return PATIENT_LIST[i]; }
	}
	return "";
}

function getRandomPatient (n) {
	var i = Math.floor(Math.random() * PATIENT_LIST.length);
	n = n || 1; // counter to stop infinite loop
	if (civData[PATIENT_LIST[i]].ill > 0 || n > 10) { 
		return PATIENT_LIST[i];
	}
	return getRandomPatient(++n);
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
		healByJob(job); 
		--civData.healer.cureCount;
		--civData.herbs.owned;
		++numHealed;
	}

	return numHealed;
}

function doPlague () {
	var jobInfected = getRandomPatient();
	var unitInfected = civData[jobInfected];
	var deathRoll = (100 * Math.random()) + 1;

	if (unitInfected.ill <= 0 || unitInfected.owned <= 0) {
		return false;
	}

	if (deathRoll <= 5) { // 5% chance that 1 person dies
		killUnit(unitInfected);
		gameLog("A sick " + unitInfected.singular + " dies.");
		// TODO: Decrease happiness
		calculatePopulation();
		return true;
	} else if (deathRoll > 99.9) { // 0.1% chance that it spreads to a new person
		spreadPlague(1);
		gameLog("The sickness spreads to a new citizen.");
		return true;
	} else {

	}
	return false;
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
		updatePopulation();
	}
}

function doCorpses() {
	var sickChance;
	var infected;
	// Nothing happens if there are no corpses
	if (civData.corpses.owned <= 0) { return; }

	// Corpses lying around will occasionally make people sick.
	// 1-in-50 chance (1-in-100 with feast)
	sickChance = 50 * Math.random() * (1 + civData.feast.owned);
	if (sickChance >= 1) { return; }

	// Infect up to 1% of the population.
	infected = Math.floor(population.living/100 * Math.random());
	if (infected <= 0) {  return; }

	infected = spreadPlague(infected);
	if (infected > 0) {
		calculatePopulation();
		gameLog(prettify(infected) + " citizens got sick"); //notify player
	}

	// Corpse has a 50-50 chance of decaying (at least there is a bright side)
	if (Math.random() < 0.5) {
		civData.corpses.owned -= 1;
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
	calculatePopulation();
}


function doSlaughter(attacker)
{
	var killVerb = (attacker.species == "animal") ? "eaten" : "killed";
	var target = randomHealthyWorker(); //Choose random worker
	var targetUnit = civData[target];
	if (target) { 
		if (targetUnit.owned >= 1) {
			// An attacker may disappear after killing
			if (Math.random() < attacker.killExhaustion) { --attacker.owned; }

			targetUnit.owned -= 1;
			// Animals will eat the corpse
			if (attacker.species != "animal") { 
				civData.corpses.owned += 1; 
			} 
			gameLog(targetUnit.getQtyName(1) + " " + killVerb + " by " + attacker.getQtyName(attacker.owned));
		}
	} else { // Attackers slowly leave once everyone is dead
		var leaving = Math.ceil(attacker.owned * Math.random() * attacker.killFatigue);
		attacker.owned -= leaving;
	}
	calculatePopulation();
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
	calculatePopulation(); // Limits might change
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

	var prod = 0;

	if (curCiv.curWonder.progress >= 100) {
		//Wonder is finished! First, send workers home
		civData.unemployed.owned += civData.labourer.owned;
		civData.unemployed.ill += civData.labourer.ill;
		civData.labourer.owned = 0;
		civData.labourer.ill = 0;
		calculatePopulation();
		
		//then set wonder.stage so things will be updated appropriately
		++curCiv.curWonder.stage;
	} else { //we're still building
		
		prod = getWonderProduction();

		//remove resources
		wonderResources.forEach(function(resource){ 
			resource.owned -= prod;
			resource.net -= prod;
		});

		//increase progress
		curCiv.curWonder.progress += prod / (1000000 * getWonderCostMultiplier());
	}
}

function getWonderLowItem () {
	var lowItem = null;
	var i = 0;
	for (i=0;i < wonderResources.length;++i) { 
		if (wonderResources[i].owned < 1) { 
			lowItem = wonderResources[i]; 
			break; 
		} 
	}
	return lowItem;	
}

function getWonderProduction () {
	var prod = civData.labourer.owned;
	// First, check our labourers and other resources to see if we're limited.
	wonderResources.forEach(function(resource){ 
		prod = Math.min(prod, resource.owned); 
	});
	return prod;
}

function isWonderLimited () {
	var prod = getWonderProduction();
	if (curCiv.curWonder.stage !== 1) { 
		return false; 
	}
	return (prod < civData.labourer.owned);

}

function doMobs() {
	//Checks when mobs will attack
	//xxx Perhaps this should go after the mobs attack, so we give 1 turn's warning?
	var mobType, choose;
	if (population.current > 0) { // No attacks if deserted.
		++curCiv.attackCounter; 
	} 
	if (population.current > 0 && curCiv.attackCounter > (60 * 5)){ //Minimum 5 minutes
		if (600*Math.random() < 1) {
			curCiv.attackCounter = 0;
			//Choose which kind of mob will attack
			mobType = "wolf"; // Default to wolves
			if (population.current >= 10000) {
				choose = Math.random();
				if      (choose > 0.5) { mobType = "barbarian"; } 
				else if (choose > 0.2) { mobType = "bandit"; }
			} else if (population.current >= 1000) {
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
	var delayMult = 60 * (3 - ((civData.currency.owned)+(civData.commerce.owned)));
	var check;
	//traders occasionally show up
	if (population.current > 0) { 
		++curCiv.trader.counter; 
	}
	if (population.current > 0 && curCiv.trader.counter > delayMult){
		check = Math.random() * delayMult;
		if (check < (1 + (0.2 * (civData.comfort.owned)))){
			curCiv.trader.counter = 0;
			startTrader();
		}
	}
	
	if (curCiv.trader.timer > 0) {
		curCiv.trader.timer--;
	}
}


function doPestControl() {
	//Decrements the pestControl Timer
	if (civData.pestControl.timer > 0) { --civData.pestControl.timer; }
}
	
function tickGlory() {
	//Handles the Glory bonus
	if (civData.glory.timer > 0){
		ui.find("#gloryTimer").innerHTML = civData.glory.timer--;
	} else {
		ui.find("#gloryGroup").style.display = "none";
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
		ui.find("#graceCost").innerHTML = prettify(civData.grace.cost);
	}
}

//========== UI functions

// Called when user switches between the various panes on the left hand side of the interface
// Returns the target pane element.
function paneSelect(control){
	var i,oldTarget;

	// Identify the target pane to be activated, and the currently active
	// selector tab(s).
	var newTarget = dataset(control,"target");
	var selectors = ui.find("#selectors");
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

function versionAlert(){
	console.log("New Version Available");
	ui.find("#versionAlert").style.display = "inline";
}

function prettify(input){
	//xxx TODO: Add appropriate format options
	return (settings.delimiters) ? Number(input).toLocaleString() : input.toString();
}


function setAutosave(value){ 
	if (value !== undefined) { settings.autosave = value; } 
	ui.find("#toggleAutosave").checked = settings.autosave;
}
function onToggleAutosave(control){ return setAutosave(control.checked); }

function setCustomQuantities(value){
	var i;
	var elems;
	var curPop = population.current;

	if (value !== undefined) { settings.customIncr = value; }
	ui.find("#toggleCustomQuantities").checked = settings.customIncr;

	ui.show("#customJobQuantity",settings.customIncr);
	ui.show("#customPartyQuantity",settings.customIncr);
	ui.show("#customBuildQuantity",settings.customIncr);
	ui.show("#customSpawnQuantity",settings.customIncr);

	elems = document.getElementsByClassName("unit10");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 10)); 
	}

	elems = document.getElementsByClassName("unit100");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 100)); 
	}

	elems = document.getElementsByClassName("unit1000");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 1000)); 
	}

	elems = document.getElementsByClassName("unitInfinity");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 1000)); 
	}

	elems = document.getElementsByClassName("building10");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 100)); 
	}

	elems = document.getElementsByClassName("building100");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 1000)); 
	}

	elems = document.getElementsByClassName("building1000");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 10000)); 
	}

	elems = document.getElementsByClassName("buildingInfinity");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],!settings.customIncr && (curPop >= 10000)); 
	}

	elems = document.getElementsByClassName("buycustom");
	for (i = 0; i < elems.length; ++i) { 
		ui.show(elems[i],settings.customIncr); 
	}
}

function onToggleCustomQuantities(control){ 
	return setCustomQuantities(control.checked); 
}

// Toggles the display of the .notes class
function setNotes(value){
	if (value !== undefined) { settings.notes = value; }
	ui.find("#toggleNotes").checked = settings.notes;

	var i;
	var elems = document.getElementsByClassName("note");
	for(i = 0; i < elems.length; ++i) {
		ui.show(elems[i],settings.notes);
	}
}

function onToggleNotes(control){ 
	return setNotes(control.checked); 
}

// value is the desired change in 0.1em units.
function textSize(value){
	if (value !== undefined) { settings.fontSize += 0.1 * value; }
	ui.find("#smallerText").disabled = (settings.fontSize <= 0.5); 

	//xxx Should this be applied to the document instead of the body?
	ui.body.style.fontSize = settings.fontSize + "em";
}

function setShadow(value){
	if (value !== undefined) { settings.textShadow = value; }
	ui.find("#toggleShadow").checked = settings.textShadow;
	var shadowStyle = "3px 0 0 #fff, -3px 0 0 #fff, 0 3px 0 #fff, 0 -3px 0 #fff"
					+ ", 2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff";
	ui.body.style.textShadow = settings.textShadow ? shadowStyle : "none";
}
function onToggleShadow(control){ 
	return setShadow(control.checked); 
}

// Does nothing yet, will probably toggle display for "icon" and "word" classes 
// as that's probably the simplest way to do this.
function setIcons(value){ 
	if (value !== undefined) { settings.useIcons = value; } 
	ui.find("#toggleIcons").checked = settings.useIcons;

	var i;
	var elems = document.getElementsByClassName("icon");
	for(i = 0; i < elems.length; ++i) {
		// Worksafe implies no icons.
		elems[i].style.visibility = (settings.useIcons && !settings.worksafe) ? "visible" : "hidden";
	}
}
function onToggleIcons(control){ 
	return setIcons(control.checked); 
}

function setDelimiters(value){
	if (value !== undefined) { settings.delimiters = value; }
	ui.find("#toggleDelimiters").checked = settings.delimiters;
	updateResourceTotals();
}
function onToggleDelimiters(control){ 
	return setDelimiters(control.checked); 
}

function setWorksafe(value){
	if (value !== undefined) { settings.worksafe = value; }
	ui.find("#toggleWorksafe").checked = settings.worksafe;

	//xxx Should this be applied to the document instead of the body?
	if (settings.worksafe){
		ui.body.classList.remove("hasBackground");
	} else {
		ui.body.classList.add("hasBackground");
	}

	setIcons(); // Worksafe overrides icon settings.
}
function onToggleWorksafe(control){ 
	return setWorksafe(control.checked); 
}


//Not strictly a debug function so much as it is letting the user know when 
//something happens without needing to watch the console.
function gameLog(message){
	//get the current date, extract the current time in HH.MM format
	//xxx It would be nice to use Date.getLocaleTimeString(locale,options) here, but most browsers don't allow the options yet.
	var d = new Date();
	var curTime = d.getHours() + ":" + ((d.getMinutes() < 10) ? "0": "") + d.getMinutes();

	//Check to see if the last message was the same as this one, if so just increment the (xNumber) value
	if (ui.find("#logL").innerHTML != message) {
		logRepeat = 0; //Reset the (xNumber) value

		//Go through all the logs in order, moving them down one and successively overwriting them.
		var i = 7; // Number of lines of log to keep.
		while (--i > 1) { ui.find("#log"+i).innerHTML = ui.find("#log"+(i-1)).innerHTML; }
		//Since ids need to be unique, log1 strips the ids from the log0 elements when copying the contents.
		ui.find("#log1").innerHTML = (
			"<td>" + ui.find("#logT").innerHTML 
			+ "</td><td>" + ui.find("#logL").innerHTML 
			+ "</td><td>" + ui.find("#logR").innerHTML + "</td>"
		);
	}
	// Updates most recent line with new time, message, and xNumber.
	var s =  "<td id='logT'>" + curTime + "</td><td id='logL'>" + message + "</td><td id='logR'>";
	if (++logRepeat > 1) { s += "(x" + logRepeat + ")"; } // Optional (xNumber)
	s += "</td>";
	ui.find("#log0").innerHTML = s;
}

function clearSpecialResourceNets () {
	civData.food.net = 0;
	civData.wood.net = 0;
	civData.stone.net = 0;
	civData.skins.net = 0;
	civData.herbs.net = 0;
	civData.ore.net = 0;
	civData.leather.net = 0;
	civData.piety.net = 0;
	civData.metal.net = 0;
}

function checkResourceLimits () {
	//Resources occasionally go above their caps.
	//Cull the excess /after/ other workers have taken their inputs.
	resourceData.forEach(function(resource){ 
		if (resource.owned > resource.limit) { 
			resource.owned = resource.limit; 
		} 
	});
}

function gameLoop () {
	//debugging - mark beginning of loop execution
	//var start = new Date().getTime();
	
	tickAutosave();

	calculatePopulation();

	// The "net" values for special resources are just running totals of the
	// adjustments made each tick; as such they need to be zero'd out at the
	// start of each new tick.
	clearSpecialResourceNets();

	// Production workers do their thing.
	doFarmers();
	doWoodcutters();
	doMiners();
	doBlacksmiths();
	doTanners();
	doClerics();
	
	// Check for starvation
	doStarve();
	// TODO: Need to kill workers who die from exposure.

	checkResourceLimits();

	//Timers - routines that do not occur every second
	doMobs();
	doPestControl();
	tickGlory();
	doShades();
	doEsiege(civData.esiege, civData.fortification);
	doRaid("party", "player", "enemy");

	//Population-related
	doGraveyards();
	doHealers();
	doPlague(); 
	doCorpses();
	doThrone();
	tickGrace();
	tickWalk();
	doLabourers();
	tickTraders();
	
	updateResourceTotals(); //This is the point where the page is updated with new resource totals
	testAchievements();
	
	//Data changes should be done; now update the UI.
	updateAll();
	
	//Debugging - mark end of main loop and calculate delta in milliseconds
	//var end = new Date().getTime();
	//var time = end - start;
	//console.log("Main loop execution time: " + time + "ms");
};





//========== TESTING (cheating)

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
	calculatePopulation();
	updateAll();
};



//========== SETUP (Functions meant to be run once on the DOM)

setup.all = function () {
	ui.find("#main").style.display = "none";
	setup.data();
	setup.civSizes();
	document.addEventListener("DOMContentLoaded", function(e){
		setup.events();
		setup.game();
		setup.loop();
		// Show the game
		ui.find("#main").style.display = "block";
	});
};

setup.events = function () {
	var openSettingsElt = ui.find(".openSettings");

	openSettingsElt.addEventListener("click", function () {
		var settingsShown = ui.toggle("#settings");
		var header = ui.find("#header");
		if (settingsShown) {
			header.className = "condensed";
			openSettingsElt.className = "selected openSettings";
		} else {
			header.className = "";
			openSettingsElt.className = "openSettings";
		}
	});
};

setup.data = function () {
	setIndexArrays(civData);
};

setup.civSizes = function () {
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
};

setup.game = function () {
	console.log("Setting up game");
	//document.title = "CivClicker ("+versionData+")"; //xxx Not in XML DOM.

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

	setDefaultSettings();
};

setup.loop = function () {
	// This sets up the main game loop, which is scheduled to execute once per second.
	console.log("Setting up Main Loop");
	gameLoop();
	loopTimer = window.setInterval(gameLoop, 1000); //updates once per second (1000 milliseconds)
};

setup.all();


/*
 * If you're reading this, thanks for playing!
 * This project was my first major HTML5/Javascript game, and was as
 * much about learning Javascript as it is anything else. I hope it
 * inspires others to make better games. :)
 *
 *     David Holley
 */
