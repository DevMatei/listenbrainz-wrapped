
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
var loading = null;
var download_btn = null;

var img = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
]
async function generate_wrapped() {
    loading.style.display = "inline-block";
    btn.disabled = true;
    download_btn.disabled = true;
    const downloadError = document.getElementById('download-error');
    downloadError.style.display = 'none';
    draw_bg();
    username = username_field.value;
    let artistImgLoaded = false;
    
    try {
        await Promise.all([
            get_listen_time(),
            (async () => {
                artistImgLoaded = await get_artist_img();
                if (artistImgLoaded) {
                    draw_bg(); // Redraw everything with the artist image
                }
            })(),
            get_top_artists(5),
            get_top_songs(5),
            get_top_genre()
        ]);
    } finally {
        generated = true;
        loading.style.display = "none";
        btn.disabled = false;
        download_btn.disabled = !artistImgLoaded;
        downloadError.style.display = artistImgLoaded ? 'none' : 'inline';
    }
async function get_artist_img() {
    artist_img.crossOrigin = "anonymous";
    try {
        let imgUrl = await (await fetch("/top/img/" + username)).text();
        return new Promise((resolve) => {
            artist_img.onload = () => {
                console.log("Artist image loaded successfully");
                resolve(true);
            };
            artist_img.onerror = (error) => {
                console.error("Failed to load artist image:", error);
                artist_img.src = "img/black.png"; // Fallback to local image
                resolve(false);
            };
            artist_img.src = imgUrl;
        });
    } catch (error) {
        console.error("Failed to fetch artist image:", error);
        artist_img.src = "img/black.png";
        return false;
    }
}
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
    if (artist_img.complete && artist_img.naturalWidth > 0) {
        ctx.drawImage(artist_img, 268, 244, 544, 544);
    }
    if (top_artists.innerHTML != null && listen_time.innerHTML != null && top_songs.innerHTML != null && username == username_field.value) {
        draw_listen_time();
        draw_top_artists();
       draw_top_songs();
       if (top_genre.innerHTML != "no genre") {
        draw_top_genre();
       }
    }
}
function draw_artist_img() {
    // Only draw if image is loaded and not broken
    if (artist_img.complete && artist_img.naturalWidth > 0) {
        ctx.drawImage(artist_img, 268, 244, 544, 544);
    }
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
    listen_time = document.getElementById('listen-time');
    artist_img = document.getElementById('artist-img');
    color_dropdown = document.getElementById('color');
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    loading = document.getElementById("loading");
    download_btn = document.getElementById("download");
    draw_bg();
    img[0].src = "img/black.png";
    img[1].src = "img/purple.png";
    img[2].src = "img/yellow.png";
    img[3].src = "img/pink.png";
    download_btn.onclick = function() {
        var link = document.createElement('a');
        link.download = 'wrapped.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    download_btn.disabled = true;
}