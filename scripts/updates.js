import ui from './ui.js';
import ajax from './ajax.js';

ajax.get('https://api.github.com/repos/deathraygames/civ-clicker/releases', (responseText, response) => {
	let h = '';
	response.forEach((release) => {
		const d = new Date(release.published_at);
		const bullets = release.body.split('* ');
		bullets.shift();
		const listItems = `<li>${bullets.join('</li><li>')}</li>`;
		h += (
			`<h2>${d.toISOString().substring(0, 10)}: ${release.name}</h2>`
			+ `<div class="body"><ul>${listItems}</ul></div>`
		);
	});
	ui.find('#github-releases').innerHTML = h;
});

ajax.get('updates_colcord.html', (responseText) => {
	const h = responseText.split('</h1>')[1].split('</body>')[0];
	ui.find('#colcord-releases').innerHTML = h;
});

ajax.get('updates_holley.html', (responseText) => {
	const h = responseText.split('</h1>')[1].split('</body>')[0];
	ui.find('#holley-releases').innerHTML = h;
});
