var btn = null;
var username_field = null;
var top_artists = null;
var top_songs = null;
var artist_img = null;
var color_dropdown = null;
var canvas = null;
var ctx = null;
var img = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
]
async function get_info() {
    var username = username_field.value;

    let artists = await fetch("/top/artists/" + username);
    top_artists.innerHTML = await artists.text();

    let tracks = await fetch("/top/tracks/" + username);
    top_tracks.innerHTML = await tracks.text();

    let img = await fetch("/top/img/" + username);
    artist_img.src = await img.text();
    draw(0);
}

function draw() {
    var img_index = 0;
    switch (color_dropdown.value) {
        case "black":
            img_index = 0;
            ctx.fillStyle = "#F2FF48";
            break;
        case "purple":
            img_index = 1;
            ctx.fillStyle = "#F2FF48";
            break;
        case "yellow":
            img_index = 2;
            ctx.fillStyle = "#151016";
            break;
        case "pink":
            img_index = 3;
            ctx.fillStyle = "#151016";
            break;   
    }
    // bg image
    ctx.drawImage(img[img_index], 0, 0);
    // artist image
    ctx.drawImage(artist_img, 268, 244, 544, 544);
    
    // light text
    ctx.font = "48px Nunito";
    ctx.fillText("Top Artists", 106, 1031);
    ctx.fillText("Top Songs", 559, 1031);
    ctx.fillText("Minutes Listened", 112, 1475);
    //ctx.fillText("Top Genre", 565, 1475);

    // small info bold text
    ctx.font = "48px Nunito-Bold";
    artists = top_artists.innerHTML.split("<br>");
    for (var i = 0; i < artists.length; i++) {
        if (artists[i].length > 17) {
            artists[i] = artists[i].substring(0,13) + "...";
        }
        ctx.fillText(artists[i], 111, 1113+i*64);
    }
    tracks = top_tracks.innerHTML.split("<br>");
    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].length > 17) {
            tracks[i] = tracks[i].substring(0,13) + "...";
        }
        ctx.fillText(tracks[i], 564, 1113+i*64);
    }
}

window.onload = function() {
    btn = document.getElementById("submit");
    btn.onclick = get_info;
    username_field = document.getElementById('username');
    top_artists = document.getElementById('top-artists');
    top_tracks = document.getElementById('top-tracks');
    artist_img = document.getElementById('artist-img');
    color_dropdown = document.getElementById('color');
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    img[0].src = "img/black.png";
    img[1].src = "img/purple.png";
    img[2].src = "img/yellow.png";
    img[3].src = "img/pink.png";
}