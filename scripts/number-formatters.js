// Number format utility functions. Originally part of civclicker.js
// - Allows testing the sign of strings that might be prefixed with '-' (like "-custom")
// - Output format uses the proper HTML entities for minus sign and infinity.
// Note that the sign of boolean false is treated as -1, since it indicates a
//   decrease in quantity (from 1 to 0).

function sgnnum(x) {
	if (x > 0) return 1;
	return (x < 0) ? -1 : 0;
}

function sgnstr(x) {
	return (x.length === 0) ? 0 : (x[0] === '-') ? -1 : 1;
}

function sgnbool(x) {
	return (x ? 1 : -1);
}

function absstr(x) {
	return (x.length === 0) ? '' : (x[0] === '-') ? x.slice(1) : x;
}

function sgn(x) {
	if (typeof x === 'number') return sgnnum(x);
	if (typeof x === 'string') return sgnstr(x);
	return (typeof x === 'boolean') ? sgnbool(x) : 0;
}

function abs(x) {
	if (typeof x === 'number') return Math.abs(x);
	return (typeof x === 'string') ? absstr(x) : x;
}

export {
	sgnnum,
	sgnstr,
	sgnbool,
	absstr,
	sgn,
	abs,
};
