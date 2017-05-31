require("component-responsive-frame/child");

var $ = require("./lib/qsa");
var closest = require("./lib/closest");

var schedule = window.swedish;
var byDate = {};
var byGuid = {};

var TIME_OFFSET = 5;
var STACKING_TOLERANCE = 1 / 60 / 24;

var guid = 0;

schedule.forEach(function(row) {
  
  if (!byDate[row.date]) byDate[row.date] = { /*bounds: { start: TIME_OFFSET, end: 24 }*/};
  if (!byDate[row.date][row.surgeon]) byDate[row.date][row.surgeon] = [];
  byDate[row.date][row.surgeon].push(row);

  ["surgeryStart", "surgeryStop", "anesthesiaStart", "anesthesiaStop"].forEach(function(prop) {
    var timeString = row[prop];
    var [hours, minutes] = timeString.split(":").map(Number);
    var ratio = (hours - TIME_OFFSET) / (24 - TIME_OFFSET);
    ratio += (minutes / 60) / (24 - TIME_OFFSET);
    row[prop + "Ratio"] = ratio;
    row[prop + "Minutes"] = hours * 60 + minutes;
  });

  row.id = guid++;
  row.start = Math.min(row.surgeryStartRatio, row.anesthesiaStartRatio);
  row.end = Math.max(row.surgeryStopRatio, row.anesthesiaStopRatio);
  byGuid[row.id] = row;
});

var days = Object.keys(byDate).sort();

var container = $.one(".schedule-container");
var rowContainer = $.one(".rows", container);
var controls = $(".schedule-controls");

controls.forEach(c => c.addEventListener("click", function(e) {
  var date = closest(e.target, "button").getAttribute("data-day");
  if (!date) {
    if (e.target.classList.contains("day")) {
      var direction = e.target.classList.contains("next") ? 1 : -1;
      var currentButtons = $("button.active-day")
      var currentDay = currentButtons[0].getAttribute("data-day");
      var index = days.indexOf(currentDay);
      index = (index + direction) % days.length;
      if (index < 0) index = days.length - 1;
      var today = days[index];
      var buttons = $(`[data-day="${today}"]`);
      currentButtons.forEach(b => b.classList.remove("active-day"));
      buttons.forEach(b => b.classList.add("active-day"));
      renderToday(today);
    }
    return;
  }
  $("button.active-day").forEach(el => el.classList.remove("active-day"));
  $(`[data-day="${date}"]`).forEach(el => el.classList.add("active-day"));
  renderToday(date);
}));

var renderToday = function(today) {
  rowContainer.innerHTML = "";
  var day = byDate[today];
  if (!day) return console.log(today, byDate[today]);
  Object.keys(day).sort((a, b) => {
    a = a.split(" ").pop();
    b = b.split(" ").pop();
    return a < b ? -1 : 1;
  }).forEach(function(name) {
    var surgeries = day[name];
    var rowSpace = [0];
    var rowHTML = [];
    var intersectionHTML = "";
    var hourHTML = ""

    var surgicalTime = 0;
    var intersectionTime = 0;

    //render anesthesia/surgery
    surgeries.sort(((a, b) => a.start - b.start)).forEach(function(s) {
      var row = rowSpace.length;
      for (var i = 0; i < rowSpace.length; i++) {
        if (rowSpace[i] + STACKING_TOLERANCE < s.start) {
          row = i;
          break;
        }
      }
      rowSpace[row] = s.end;
      surgicalTime += s.surgeryStopMinutes - s.surgeryStartMinutes;
      if (!rowHTML[row]) rowHTML[row] = "";
      var aCoords = {
        left: s.anesthesiaStartRatio * 100,
        width: (s.anesthesiaStopRatio - s.anesthesiaStartRatio) * 100
      };
      var sCoords = {
        left: s.surgeryStartRatio * 100,
        width: (s.surgeryStopRatio - s.surgeryStartRatio) * 100
      };
      rowHTML[row] += `
<div data-guid="${s.id}">
  <div
    class="anesthesia rectangle"
    style="left: ${aCoords.left.toFixed(1)}%; width: ${aCoords.width.toFixed(1)}%;"
  >
  </div>
  <div
    class="surgery rectangle"
    style="left: ${sCoords.left.toFixed(1)}%; width: ${sCoords.width.toFixed(1)}%;"
  >
  </div>
</div>
      `
    });

    //build the list of intersections
    for (var i = 0; i < surgeries.length; i++) {
      var s = surgeries[i];
      for (var j = i + 1; j < surgeries.length; j++) {
        var t = surgeries[j];
        var start = Math.max(s.surgeryStartRatio, t.surgeryStartRatio);
        var end = Math.min(s.surgeryStopRatio, t.surgeryStopRatio);
        var startMinute = Math.max(s.surgeryStartMinutes, t.surgeryStartMinutes);
        var endMinute = Math.min(s.surgeryStopMinutes, t.surgeryStopMinutes);
        if (end > start) {
          intersectionTime += endMinute - startMinute;
          var x = start * 100;
          var width = (end - start) * 100;
          intersectionHTML += `
<div
  class="intersection rectangle"
  style="left: ${x.toFixed(1)}%; width: ${width.toFixed(1)}%;"
>
</div>
        `;
        }
      }
    }

    //render the hour markers
    for (var i = TIME_OFFSET; i < 24; i++) {
      var x = (i - TIME_OFFSET) / 19 * 100;
      hourHTML += `
<div class="hour"
  style="left: ${x.toFixed(1)}%;"
  data-hour="${i}"
>
  ${i > 12 ? i - 12 + " PM" : i == 12 ? i + " PM" : i + " AM"}
</div>
<div
  class="tick"
  data-hour="${i}"
  style="left: ${x.toFixed(1)}%"
></div>
      `
    }

    var docElement = document.createElement("div");
    docElement.className = "doctor";
    var rows = rowHTML.map(r => `<div class="row">${r}</div>`).join("");
    var intersections = 
    docElement.innerHTML = `
<div class="info">
  <h2>${name}</h2>
  <span class="stats" data-intersection="${intersectionTime}">
    Overlapping surgery time: <span class="overlap">${(intersectionTime * 2 / surgicalTime * 100).toFixed(1)}%</span>
  </span>
</div>
<div class="schedule">
  ${intersectionHTML}
  <div class="timeline">${hourHTML}</div>
  <div class="rows">${rows}</div>
</div>
    `;
    rowContainer.appendChild(docElement);
  });
}

renderToday(days[0]);

var formatDate = d => {
  var suffix = "AM";
  var [hour, minute] = d.split(":");
  hour = hour * 1;
  if (hour == 24) {
    hour = 12;
  } else if (hour > 12) {
    suffix = "PM";
    hour -= 12;
  } else if (hour == 12) {
    suffix = "PM";
  }
  return `${hour}:${minute} ${suffix}`;
}

var tooltip = $.one(".tooltip", container);

var sentence = s => s.toLowerCase().replace(/^\w|\s\w/g, c => c.toUpperCase());

var onMove = function(e) {
  var parent = e.target.parentElement;
  var id = parent.getAttribute("data-guid");
  var data = byGuid[id];
  if (!data) {
    tooltip.classList.remove("show");
  } else {
    var bounds = container.getBoundingClientRect();
    tooltip.innerHTML = `
<h3>${sentence(data.procedure)}</h3>
<ul>
  <li> Anesthesia: ${formatDate(data.anesthesiaStart)} - ${formatDate(data.anesthesiaStop)}
  <li> Surgery: ${formatDate(data.surgeryStart)} - ${formatDate(data.surgeryStop)}
<ul>
    `;
    tooltip.classList.add("show");
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    var y = e.touches ? e.touches[0].clientY : e.clientY;
    var tx = x - bounds.left;
    if (tx > bounds.width / 2) tx = x - bounds.left - tooltip.offsetWidth;
    tooltip.style.left = tx + "px";
    tooltip.style.top = (y - bounds.top + 20) + "px";
  }
};

rowContainer.addEventListener("mousemove", onMove);
rowContainer.addEventListener("touchmove", onMove);