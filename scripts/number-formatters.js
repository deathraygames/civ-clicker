// Number format utility functions. Originally part of civclicker.js
// - Allows testing the sign of strings that might be prefixed with '-' (like "-custom")
// - Output format uses the proper HTML entities for minus sign and infinity.
// Note that the sign of boolean false is treated as -1, since it indicates a
//   decrease in quantity (from 1 to 0).

function sgnnum(x) {
	return (x > 0) ? 1 : (x < 0) ? -1 : 0;
}

function sgnstr(x) {
	return (x.length === 0) ? 0 : (x[0] == "-") ? -1 : 1;
}

function sgnbool(x) {
	return (x ? 1 : -1);
}

function absstr(x) {
	return (x.length === 0) ? "" : (x[0] == "-") ? x.slice(1) : x;
}

function sgn(x) {
	return (typeof x == "number") ? sgnnum(x) : (typeof x == "string") ? sgnstr(x) : (typeof x == "boolean") ? sgnbool(x) : 0;
}

function abs(x) {
	return (typeof x == "number") ? Math.abs(x) : (typeof x == "string") ? absstr(x) : x;
}

export {
	sgnnum,
	sgnstr,
	sgnbool,
	absstr,
	sgn,
	abs,
};
