## How I used AI

### Plan features and structures

- Claude assisted with choosing how much or how little I should do for this app from planning all the way to refinement. I had a lot more features that I initially intended to implement, but after consulting with Claude on their feasability, I opted not to proceed. Even the initial Bookmarks screen I had planned, which had made it all the way to development, was eventually scrapped since it seemed redundant with the app's current state.
- **Commit:** Not Applicable - Not Development Related

### Construct frontend for my wireframe screens

- I used AI for constructing the code for my frontend screens. I made the design myself using figma, then uploaded those screens to Claude with my specified color hexcodes to ensure accuracy with my vision. For any assets that I wanted to provide myself, such as my logo, I asked Claude to leave it as a placeholder.
- **Commit:** https://github.com/fromHELIO/DinkSync/commit/bfdd4eb7889497becb07dd60e578e86f0fa7854d

### Create Scraper

- As I had never made anything with this kind of technology before, I had AI create it. It provided me with the code that I needed, the method on how to employ it, and how to connect it with other parts of my app.
- **Commit:** https://github.com/fromHELIO/DinkSync/commit/ee4d36ceb5a318563a1085f3116f6581a19361f0

### Improve scraper

- The scraper was highly innacurate at first on account of different technologies and modes of presentation between pickleball booking services. Noticing this, I went back and had AI improve it based ont he lapses I had identified.
- **Commit:** https://github.com/fromHELIO/DinkSync/commit/930c5b7fd662c67c1a519a88c498107692626051

### Assist in solving deployment issues
- I came across several issues while trying to deploy the code to Render, as someone who had never used the service before. Some of the technologies I used, such as puppeteer, required specific steps to be workable on a cloud interface, which Claude as able to identify and assited me in rectifying.
- **Commit:** https://github.com/fromHELIO/DinkSync/commit/6dd590249e2a4976e632c6359450b42e2a577461

### General Dos and Don't Dos
- A project of this scale was something I had never done before, so having a readily available assistant to assist in the little things (*'Is the contrast okay? Am I saying this part in the video right? Is my solution appropriate for this type of project?'*) was incredibly helpful. It eased a lot of my little anxieties about having to do it perfectly.
- **Commit:** Not Applicable - Not Development Related

---

## Where the AI got it wrong

### Scraper Capabilities

- Claude and Gemini were not quite clear on the exact extents the scraper was able of going to in regards to retrieivng court data. I found out mid-development that, with the method It had employed and I was committed to seeing through, was incapable of bypassing certain security measures and layout choices of services like Sports360 and Ground002's proprietary site. As such, I had to go back and change some of the frontend to ensure that these would be accounted for.

### Overengineering

- It is a common sickness of AI, but one I had witnessed firsthand by leaps and bounds while completing this project. Gemini was especially fond of forcing complicated solutions with the intent of achieving the most accurate results, which would only break the code further. Their initial solution checked for specific colors to identify wether a cell (representing a certain court at a certain time slot) was booked or available. This was highly unreliable as not every court, even those from the same platform (rezerve) used the same color scheme. I eventually had to suggest clickability or hoverability, which I had thought of myself, for them to produce a better solution.

### Frontend Misunderstandings

- It misunderstood what I wanted out of the time and date selectors of the app. While the logic was being progressed through, I noticed that the dates and time were static elements directly copied from my wireframe, not clickable media for real date and time selectors. I had gemini quickly rectify this, but was still bothered that something so obvious was done in that manner. 

---
