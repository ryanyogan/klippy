// A small made-up library for measuring retrieval: six documents and twelve questions, each with the document that
// answers it. Replace these with your own saved things and the questions you really ask.
export const documents: Record<string, string> = {
	'pip.md': '# Pip\n\nPip is our border collie. She was born in March 2023.\n\n## Food\n\nPip eats kibble twice a day and loves raw carrots. No grapes, ever: they are toxic to dogs.\n\n## Vet\n\nDr Okafor at Riverside Vets. Booster jabs are due every May.',
	'lisbon-trip.md': '# Lisbon, June\n\nFlights: TP1337 leaves Dublin at 07:10 on 14 June, back on 21 June.\n\n## Stay\n\nApartment in Alfama, check-in after 15:00, the key box code is sent the day before.\n\n## Plans\n\nTram 28 early to beat the queues. Dinner booked at a fado house on the 17th.',
	'bike.md': '# Bike maintenance\n\nThe road bike has 25 mm tyres; pump them to 80 psi front and 85 psi rear.\n\n## Chain\n\nClean and lube the chain every 300 km, or after any wet ride. Replace it when the checker reads 0.5.',
	'sourdough.md': '# Sourdough\n\nFeed the starter 1:1:1 by weight the night before.\n\n## Bake\n\n500 g flour, 350 g water, 100 g starter, 10 g salt. Bulk ferment 5 hours, shape, cold proof overnight, bake at 250 C in a lidded pot for 20 minutes, then 20 more without the lid.',
	'work-notes.md': '# Work\n\nThe quarterly review is on the first Thursday of each quarter.\n\n## Deploys\n\nWe deploy from main after CI passes. Rollbacks use wrangler rollback. Never deploy on Fridays after 3 pm.',
	'garden.md': '# Garden\n\nTomatoes go out after the last frost, usually mid May. Water at the base, not the leaves.\n\n## Pests\n\nSlugs: beer traps and copper tape. Aphids: a strong spray of water, then ladybirds.',
};

export const questions: { q: string; answer: string }[] = [
	{ q: 'What vegetable does my dog like?', answer: 'pip.md' },
	{ q: 'When are the vaccinations due for the dog?', answer: 'pip.md' },
	{ q: 'What is the flight number to Portugal?', answer: 'lisbon-trip.md' },
	{ q: 'Which tram should we take early?', answer: 'lisbon-trip.md' },
	{ q: 'What pressure for the tyres?', answer: 'bike.md' },
	{ q: 'How often should I oil the chain?', answer: 'bike.md' },
	{ q: 'How much salt goes in the bread?', answer: 'sourdough.md' },
	{ q: 'What temperature do I bake the loaf at?', answer: 'sourdough.md' },
	{ q: 'When is the quarterly review?', answer: 'work-notes.md' },
	{ q: 'How do we undo a bad release?', answer: 'work-notes.md' },
	{ q: 'When can the tomatoes be planted outside?', answer: 'garden.md' },
	{ q: 'How do I get rid of slugs?', answer: 'garden.md' },
];
