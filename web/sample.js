// The example portfolio ("see an example"). Made-up person; screenshots are drawn by the page.
export function sampleState() {
  return {
    v: 1, theme: "clean",
    profile: {
      name: "Asha Rao", role: "Full-stack developer", tagline: "I build small, fast web apps that work offline.",
      about: "I am a final-year computer engineering student in Pune. I like turning everyday annoyances into tools that run in the browser, with no sign-up and no server.\n\nRight now I am learning TypeScript and looking for an internship where I can ship to real users.",
      location: "Pune, India", email: "asha@example.com", github: "asha-rao", linkedin: "asha-rao", website: "", photo: "",
      skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL"],
    },
    projects: [
      { id: "ex1", title: "Hisaab", summary: "Tick the days the maid or milkman missed and get the month's bill, with a WhatsApp message to send.", tags: ["JavaScript", "PWA", "Offline"], live: "https://asha-rao.github.io/Hisaab/", repo: "https://github.com/asha-rao/Hisaab", image: "", featured: true },
      { id: "ex2", title: "Pakka", summary: "A GST invoice maker for small shops with the tax split, amount in words and a UPI QR.", tags: ["JavaScript", "GST", "QR"], live: "https://asha-rao.github.io/Pakka/", repo: "https://github.com/asha-rao/Pakka", image: "", featured: false },
      { id: "ex3", title: "Bunkmeter", summary: "Tells you how many lectures you can still skip and stay above 75% attendance.", tags: ["React", "localStorage"], live: "", repo: "https://github.com/asha-rao/Bunkmeter", image: "", featured: false },
    ],
  };
}
