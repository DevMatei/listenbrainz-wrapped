var btn = null;
var username_field = null;
var top_artists = null;
var top_songs = null;
var artist_img = null;

async function get_info() {
    var username = username_field.value;

    let artists = await fetch("/top/artists/" + username);
    top_artists.innerHTML = await artists.text();

    let tracks = await fetch("/top/tracks/" + username);
    top_tracks.innerHTML = await tracks.text();

    let img = await fetch("/top/img/" + username);
    artist_img.src = await img.text();

}

window.onload = function() {
    btn = document.getElementById("submit");
    btn.onclick = get_info;
    username_field = document.getElementById('username');
    top_artists = document.getElementById('top-artists');
    top_tracks = document.getElementById('top-tracks');
    artist_img = document.getElementById('artist-img')
}