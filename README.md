# MarkaClip

Instagram Reels, gönderi ve hikâyelerini tek tıkla indiren Chrome eklentisi, Markavio tarafından.

<img src="assets/logo/markaclip-logo.svg" alt="MarkaClip" height="64">

## Kurulum

Ekip için adım adım rehber: **[KURULUM.md](KURULUM.md)**. Kısaca:
[Releases](https://github.com/musabustun/markaclip/releases/latest) sayfasından zip'i indir, bir klasöre çıkar, `chrome://extensions` sayfasında **Geliştirici modu** açıkken **Paketlenmemiş öğe yükle** ile o klasörü seç.

Geliştirirken repo klasörünün kendisi de doğrudan yüklenebilir.

## Paketleme ve yayınlama

```bash
./scripts/package.sh   # dist/markaclip-v<sürüm>.zip
```

Yeni sürüm için `manifest.json` içindeki `version`'ı artır, paketle ve zip'i GitHub Release olarak yükle:

```bash
gh release create v1.0.1 dist/markaclip-v1.0.1.zip --title "MarkaClip v1.0.1"
```

Aynı zip, Chrome Web Store'a **Liste dışı (Unlisted)** olarak da yüklenebilir. Böylece geliştirici modu gerekmez ve güncellemeler otomatik gelir. Tek seferlik 5 $ geliştirici kaydı ve mağaza incelemesi gerekir.

## Kullanım

| Nerede | Buton nerede | Not |
| --- | --- | --- |
| **Reels** | Sağ sütunda Kaydet ikonunun hemen altında | En yüksek çözünürlüklü MP4 (sesli) iner |
| **Gönderi / akış** | Kaydet ikonunun solunda | Albümde o an görünen kare iner, **Shift + tık** tüm albümü indirir |
| **Hikâye** | Üst çubukta oynat/duraklat düğmesinin yanında | Bulunamazsa sağ altta "İndir" butonu çıkar. Öne çıkanlar da desteklenir |

Dosyalar `İndirilenler/MarkaClip/kullanıcıadı_kısakod[_n].mp4|jpg` olarak kaydedilir. Klasör ve "her indirmede konum sor" ayarı eklenti popup'ında.

## Nasıl çalışıyor

- Instagram videoları sayfada `blob:` adresiyle oynatır, doğrudan indirilemez. MarkaClip içeriğin kısa kodunu (URL ya da gönderi bağlantısından) medya ID'sine çevirir ve Instagram'ın kendi web API'sinden (`/api/v1/media/{id}/info/`) oturum çerezleriyle orijinal CDN adresini alır.
- Butonlar, Instagram'ın Beğen/Kaydet ikonları `aria-label` (TR/EN/DE/FR/ES/IT) ya da SVG şekli üzerinden bulunarak eklenir. Instagram'ın sınıf adlarına bağımlı değildir.
- Servis çalışanı yalnızca `instagram.com` sekmelerinden gelen ve `*.cdninstagram.com` / `*.fbcdn.net` adreslerini içeren istekleri kabul eder. Dosya adı ve klasör yolu temizlenir.

```
manifest.json
src/
  background.js            indirme servisi + doğrulama
  content/
    constants.js           etiketler, ikonlar, hata mesajları
    instagram-api.js       shortcode ↔ id, medya/hikâye API'si
    resolver.js            tıklanan butondan indirilecek dosyalara
    ui.js                  buton durumları, toast
    inject.js              DOM izleme ve buton yerleştirme
    content.css
  popup/                   marka popup'ı ve ayarlar
assets/logo/               markaclip-mark.svg, markaclip-logo.svg
assets/icons/              16/32/48/128 PNG
```

## Logo

Markavio kimliğinden türetildi: siyah zemin, `#D7FF00` lime, beyaz. İndirme okunun ucu, Markavio işaretindeki "V" kurdelesi. Beyaz kol, logodaki sivri kıvrık uçla başlar ve lime şeridin üzerinden geçer. Yazı tipi markavio'daki ritmi izler: ince "marka" + kalın "clip" (Degular, yoksa Inter Tight/Inter).

İkonları SVG'den yeniden üretmek için:

```bash
./scripts/export-icons.sh
```

## Test

```bash
node --test tests/unit.test.mjs
```

`tests/fixtures/mock-instagram.html`, Instagram'ın Reels sütununu ve akış gönderisini taklit eden bir test sayfası. Proje kökünde `python3 -m http.server 5178` çalıştırıp `http://localhost:5178/tests/fixtures/mock-instagram.html` adresini açınca buton yerleşimi ve tıklama akışı (sahte `chrome`/`fetch` ile) denenebilir.

## Bilinen sınırlar

- Instagram arayüzü sık değişiyor. Buton görünmezse önce `src/content/constants.js` içindeki `LABELS` / `SELECTORS` güncellenmeli.
- Gizli hesapların içerikleri yalnızca takip ediliyorsa iner (API oturumla çalışır).
- Yalnızca hakkına sahip olduğun ya da kullanım izni aldığın içerikleri indir. Instagram kullanım koşulları geçerlidir.
