const ajax = {};
ajax.get = function ajaxGet(url, callback) {
	const req = new XMLHttpRequest();
	req.onreadystatechange = function ajaxOnReadyStateChange() {
		if (req.readyState === XMLHttpRequest.DONE) {
			if (req.status === 200) {
				let response = null;
				try {
					response = JSON.parse(req.responseText);
				} catch (err) {
					console.warn(err);
				}
				callback(req.responseText, response);
			} else if (req.status === 400) {
				console.error('Ajax 400 error', req);
			} else {
				console.error('Ajax non-400 error', req);
			}
		}
	};
	req.open('GET', url, true);
	req.send();
};

export default ajax;
