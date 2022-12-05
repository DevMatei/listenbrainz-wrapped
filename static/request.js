var btn = null;
var username_field = null;
var top_artists = null;
var top_songs = null;
var top_genre = null;
var listen_time = null;
var artist_img = null;
var color_dropdown = null;
var canvas = null;
var ctx = null;
var generated = false;

var img = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
]
async function generate_wrapped() {
    draw_bg();
    username = username_field.value;
    get_listen_time();
    get_artist_img();
    get_top_artists(5);
    get_top_songs(5);
    get_top_genre();
    generated = true;
}
async function get_artist_img() {
    artist_img.src = await (await fetch("/top/img/" + username)).text();
    draw_artist_img();
}
async function get_top_artists(number) {
    top_artists.innerHTML = await (await fetch("/top/artists/" + username + "/" + number + "/formatted")).text();
    draw_top_artists();
}
async function get_top_songs(number) {
    top_songs.innerHTML = await (await fetch("/top/tracks/" + username + "/" + number + "/formatted")).text();
    draw_top_songs();
}
async function get_listen_time() {
    listen_time.innerHTML = await (await fetch("/time/total/" + username)).text();
    draw_listen_time();
}
async function get_top_genre() {
    top_genre.innerHTML = await (await fetch("/top/genre/user/" + username)).text();
    if (top_genre.innerHTML != "no genre") {
        draw_top_genre();
    }
}

function draw_bg() {
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
    ctx.drawImage(img[img_index], 0, 0);
    if (top_artists.innerHTML != null && listen_time.innerHTML != null && top_songs.innerHTML != null && username == username_field.value) {
       draw_artist_img();
       draw_listen_time();
       draw_top_artists();
       draw_top_songs();
       if (top_genre.innerHTML != "no genre") {
        draw_top_genre();
       }
    }
}
function draw_artist_img() {
    ctx.drawImage(artist_img, 268, 244, 544, 544);
}
    
function draw_top_artists() {
    ctx.font = "48px Nunito";
    ctx.fillText("Top Artists", 106, 1031);
    ctx.font = "48px Nunito-Bold";
    artists = top_artists.innerHTML.split("<br>");
    for (var i = 0; i < artists.length; i++) {
        if (artists[i].length > 17) {
            artists[i] = artists[i].substring(0,13) + "...";
        }
        ctx.fillText(artists[i], 111, 1113+i*64);
    }
}

function draw_top_songs() {
    ctx.font = "48px Nunito";
    ctx.fillText("Top Songs", 559, 1031);
    ctx.font = "48px Nunito-Bold";
    tracks = top_songs.innerHTML.split("<br>");
    for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].length > 17) {
            tracks[i] = tracks[i].substring(0,13) + "...";
        }
        ctx.fillText(tracks[i], 564, 1113+i*64);
    }
}

function draw_listen_time() {
    ctx.font = "48px Nunito-Bold";
    ctx.fillText("Minutes Listened", 112, 1475);
    ctx.font = "77px Nunito-Bold";
    ctx.fillText(listen_time.innerHTML, 112, 1575);
}

// does nothing
function draw_top_genre() {
    ctx.font = "48px Nunito-Bold";
    ctx.fillText("Top Genre", 565, 1475);
    ctx.font = "77px Nunito-Bold"; 
    ctx.fillText(top_genre.innerHTML, 565, 1575);
}

window.onload = function() {
    btn = document.getElementById("submit");
    btn.onclick = generate_wrapped;
    username_field = document.getElementById('username');
    top_artists = document.getElementById('top-artists');
    top_songs = document.getElementById('top-tracks');
    top_genre = document.getElementById('top-genre');
    listen_time = document.getElementsByTagName('listen-time');
    artist_img = document.getElementById('artist-img');
    color_dropdown = document.getElementById('color');
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    draw_bg();
    img[0].src = "img/black.png";
    img[1].src = "img/purple.png";
    img[2].src = "img/yellow.png";
    img[3].src = "img/pink.png";
}