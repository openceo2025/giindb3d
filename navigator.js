function openNav() {
  document.getElementById("mySidenav").style.width = "250px";
}

function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
}
  
function clearLocalStorage() {
  localStorage.clear();
  location.reload();
}

function saveJSON(cardData){
  console.log("save");
  console.log(cardData);  
  cardData.downloadJSON();
}

function loadJSON(cardData){
  console.log(cardData);
  cardData.uploadJSON();
}