import ui from './ui.js';
import ajax from './ajax.js';

ajax.get("https://api.github.com/repos/deathraygames/civ-clicker/releases", function(responseText, response){
	var h = '';
	response.forEach(function(release) {
		var d = new Date(release.published_at);
		var bullets = release.body.split("* ");
		bullets.shift();
		h += (
			'<h2>' + d.toISOString().substring(0, 10) + ': ' + release.name + '</h2>'
			+ '<div class="body"><ul>'
				+ '<li>' + bullets.join('</li><li>') + '</li>'
			+ '</ul></div>'
		);
	});
	ui.find("#github-releases").innerHTML = h;
});
ajax.get("updates_colcord.html", function(responseText){
	var h = responseText.split('</h1>')[1].split('</body>')[0];
	ui.find("#colcord-releases").innerHTML = h;
});
ajax.get("updates_holley.html", function(responseText){
	var h = responseText.split('</h1>')[1].split('</body>')[0];
	ui.find("#holley-releases").innerHTML = h;
});
