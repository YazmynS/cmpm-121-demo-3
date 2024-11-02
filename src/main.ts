//Task 1: Add Message Button
const button = document.createElement("button");
button.textContent = "Say Hi!";

//Add Message Button Functionality
button.addEventListener("click", () => {
  alert("You said Hi!");
});

// Put  Message Button on Page
document.body.appendChild(button);
