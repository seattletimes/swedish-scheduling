require("component-responsive-frame/child");

var $ = require("./lib/qsa");
var closest = require("./lib/closest");

var schedule = window.swedish;
var byDate = {};
var byGuid = {};

var ROW_WIDTH = 800;
var TEXT_SIZE = ROW_WIDTH / 90;
var ROW_HEIGHT = ROW_WIDTH / 40;
var SCHEDULE_PADDING = ROW_HEIGHT * .75;
var ROW_PADDING = ROW_HEIGHT / 10;
var ANESTHESIA_PADDING = ROW_PADDING * .5;

var guid = 0;

schedule.forEach(function(row) {
  
  if (!byDate[row.date]) byDate[row.date] = {};
  if (!byDate[row.date][row.surgeon]) byDate[row.date][row.surgeon] = [];
  byDate[row.date][row.surgeon].push(row);

  ["surgeryStart", "surgeryStop", "anesthesiaStart", "anesthesiaStop"].forEach(function(prop) {
    var timeString = row[prop];
    var [hours, minutes] = timeString.split(":").map(Number);
    var ratio = hours / 24;
    ratio += (minutes / 60) / 24;
    row[prop + "Ratio"] = ratio;
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
  Object.keys(day).sort().forEach(function(name) {
    var surgeries = day[name];
    var rows = [0];
    var rowGroup = "";
    var intersectionGroup = "";
    var hourGroup = ""

    var surgicalTime = 0;
    var intersectionTime = 0;

    //render anesthesia/surgery
    surgeries.sort((a, b) => a.start - b.start).forEach(function(s) {
      var row = rows.length;
      rows.forEach(function(r, i) {
        if (r < s.start) row = i;
      });
      rows[row] = s.end;
      surgicalTime += s.surgeryStopRatio - s.surgeryStartRatio;
      rowGroup += `
<g data-guid="${s.id}">
  <rect
    class="anesthesia-rectangle"
    x="${s.anesthesiaStartRatio * ROW_WIDTH}"
    y="${row * ROW_HEIGHT + ROW_PADDING + ANESTHESIA_PADDING + SCHEDULE_PADDING}"
    width="${(s.anesthesiaStopRatio - s.anesthesiaStartRatio) * ROW_WIDTH}"
    height="${ROW_HEIGHT - ROW_PADDING * 2 - ANESTHESIA_PADDING * 2}">
  </rect>
  <rect
    class="surgery-rectangle"
    x="${s.surgeryStartRatio * ROW_WIDTH}"
    y="${row * ROW_HEIGHT + ROW_PADDING + SCHEDULE_PADDING}"
    width="${(s.surgeryStopRatio - s.surgeryStartRatio) * ROW_WIDTH}"
    height="${ROW_HEIGHT - ROW_PADDING * 2}">
  </rect>
</g>
      `
    });

    //build the list of intersections
    for (var i = 0; i < surgeries.length; i++) {
      var s = surgeries[i];
      for (var j = i + 1; j < surgeries.length; j++) {
        var t = surgeries[j];
        var start = Math.max(s.surgeryStartRatio, t.surgeryStartRatio);
        var end = Math.min(s.surgeryStopRatio, t.surgeryStopRatio);
        if (end > start) {
          intersectionTime += end - start;
          intersectionGroup += `
<rect
  class="intersection-rectangle"
  x="${start * ROW_WIDTH}"
  y="0"
  width="${(end - start) * ROW_WIDTH}"
  height="${ROW_HEIGHT * rows.length + SCHEDULE_PADDING * 2}">
</rect>
        `;
        }
      }
    }

    //render the hour markers
    for (var i = 5; i < 24; i++) {
      hourGroup += `
<text
  x="${i / 24 * ROW_WIDTH + 2}"
  y="${TEXT_SIZE}"
  style="font-size: ${TEXT_SIZE}px"
  data-hour="${i}"
>
  ${i > 12 ? i - 12 + " PM" : i + " AM"}
</text>
<line
  class="tick"
  data-hour="${i}"
  x1="${i / 24 * ROW_WIDTH}"
  x2="${i / 24 * ROW_WIDTH}"
  y1="0"
  y2="${rows.length * ROW_HEIGHT + SCHEDULE_PADDING * 2}"
></line>
      `
    }

    var earliest = 5 / 24 * ROW_WIDTH;
    var latest = ROW_WIDTH - earliest;
    var viewBox = `${earliest} 0 ${latest} ${ROW_HEIGHT * rows.length + SCHEDULE_PADDING * 2}`;

    var docElement = document.createElement("div");
    docElement.className = "doctor";
    docElement.innerHTML = `
<div class="info">
  <h2>${name}</h2>
  <span class="stats" data-intersection="${intersectionTime}">
    Overlapping surgery: <span class="overlap">${(intersectionTime * 2 / surgicalTime * 100).toFixed(1)}%</span>
  </span>
</div>
<svg class="schedule" viewbox="${viewBox}" data-rows="${rows.length}" preserveAspectRatio="xMinYMin meet">
  <g class="shading">${intersectionGroup}</g>
  <g class="hours">${hourGroup}</g>
  <g class="surgeries">${rowGroup}</g>
</svg>
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