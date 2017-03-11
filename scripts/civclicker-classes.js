
function VersionData(major,minor,sub,mod) {
	this.major = major;
	this.minor = minor;
	this.sub = sub;
	this.mod = mod;
}
VersionData.prototype.toNumber = function() { return this.major*1000 + this.minor + this.sub/1000; };
VersionData.prototype.toString = function() { return String(this.major) + "." 
	+ String(this.minor) + "." + String(this.sub) + String(this.mod); };

// TODO: Create a mechanism to automate the creation of a class hierarchy,
// specifying base class, shared props, instance props.
function CivObj(props, asProto)
{
	if (!(this instanceof CivObj)) { return new CivObj(props); } // Prevent accidental namespace pollution
	//xxx Should these just be taken off the prototype's property names?
	var names = asProto ? null : [
		"id","name","subType","owned","prereqs","require","salable","vulnerable","effectText"
		,"prestige","initOwned","init","reset","limit","hasVariableCost"
	];
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
	get net() { 
		if (typeof this.data.net !== "number") {
			console.warn(".net not a number");
			return 0;
		}
		return this.data.net; 
	},
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
	type: 			"unit",
	salable: 		true,
	get customQtyId() { 
		return this.place + "CustomQty"; 
	},
	set customQtyId(value) { 
		return this.customQtyId; 
	}, // Only here for JSLint.
	alignment: 		"player", // Also: "enemy"
	species: 		"human", // Also:  "animal", "mechanical", "undead"
	place: 			"home", // Also:  "party"
	combatType: 	"",  // Default noncombatant.  Also "infantry","cavalry","animal"
	onWin: function() { return; }, // Do nothing.
	get vulnerable() { 
		return ((this.place == "home")&&(this.alignment=="player")&&(this.subType=="normal")); 
	},
	set vulnerable(value) { 
		return this.vulnerable; 
	}, // Only here for JSLint.
	get isPopulation () {
		if (this.alignment != "player") { 
			return false; 
		} else if (this.subType == "special" || this.species == "mechanical") { 
			return false;
		} else {
			//return (this.place == "home")
			return true;
		}
	},
	set isPopulation (v) {
		return this.isPopulation;
	},
	init: function(fullInit) { 
		CivObj.prototype.init.call(this,fullInit);
		// Right now, only vulnerable human units can get sick.
		if (this.vulnerable && (this.species=="human")) {
			this.illObj = { owned: 0 };
		} 
		return true; 
	},
	//xxx Right now, ill numbers are being stored as a separate structure inside curCiv.
	// It would probably be better to make it an actual 'ill' property of the Unit.
	// That will require migration code.
	get illObj() { 
		return curCiv[this.id+"Ill"]; 
	},
	set illObj(value) { 
		curCiv[this.id+"Ill"] = value; 
	}, 
	get ill() { 
		return isValid(this.illObj) ? this.illObj.owned : undefined; 
	},
	set ill(value) { 
		if (isValid(this.illObj)) { this.illObj.owned = value; } 
	},
	get partyObj() { 
		return civData[this.id+"Party"]; 
	},
	set partyObj(value) { 
		return this.partyObj; 
	}, // Only here for JSLint.
	get party() { 
		return isValid(this.partyObj) ? this.partyObj.owned : undefined; 
	},
	set party(value) { 
		if (isValid(this.partyObj)) { 
			this.partyObj.owned = value; 
		} 
	},
	// Is this unit just some other sort of unit in a different place (but in the same limit pool)?
	isDest: function() { 
		return (this.source !== undefined) && (civData[this.source].partyObj === this); 
	},
	get limit() { 
		return (this.isDest()) ? civData[this.source].limit 
											 : Object.getOwnPropertyDescriptor(CivObj.prototype,"limit").get.call(this); 
	},
	set limit(value) { 
		return this.limit; 
	}, // Only here for JSLint.

	// The total quantity of this unit, regardless of status or place.
	get total() { 
		return (this.isDest()) ? civData[this.source].total : (this.owned + (this.ill||0) + (this.party||0)); 
	},
	set total(value) { 
		return this.total; 
	} // Only here for JSLint.
},true);

function Achievement(props) // props is an object containing the desired properties.
{
	if (!(this instanceof Achievement)) { 
		// Prevent accidental namespace pollution
		return new Achievement(props); 
	} 
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
	get limit() { 		return 1; }, // Can't re-buy these.
	set limit(value) { 	return this.limit; } // Only here for JSLint.
},true);