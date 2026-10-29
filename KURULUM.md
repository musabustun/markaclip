# MarkaClip Kurulum Rehberi

Ajans içi kurulum için 2 dakikalık rehber. Chrome, Edge, Brave ve Arc'ta çalışır.

## 1. İndir

[Releases sayfasından](https://github.com/musabustun/markaclip/releases/latest) en güncel `markaclip-vX.Y.Z.zip` dosyasını indir.

## 2. Kalıcı bir klasöre çıkar

Zip'i çift tıklayıp aç ve çıkan klasörü **silinmeyecek** bir yere taşı, örneğin `Belgeler/MarkaClip`.

> ⚠️ Chrome eklentiyi bu klasörden çalıştırır. Klasörü silersen ya da taşırsan eklenti kaybolur.

## 3. Chrome'a yükle

1. Adres çubuğuna `chrome://extensions` yaz.
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle**ye tıkla ve 2. adımdaki klasörü seç (içinde `manifest.json` olan klasör).
4. Yapboz ikonundan MarkaClip'i **sabitle** (📌).

## 4. Kullan

instagram.com'a giriş yap, açık sekmeleri yenile.

- **Reels:** sağ sütunda Kaydet ikonunun altındaki ⤓ ikonu
- **Gönderi:** Kaydet ikonunun solundaki ⤓ ikonu (Shift + tık = tüm albüm)
- **Hikâye:** üst çubukta oynat/duraklat düğmesinin yanındaki ⤓ ikonu

Dosyalar `İndirilenler/MarkaClip` klasörüne iner.

## Güncelleme

1. Yeni zip'i indir ve aynı klasörün **içeriğini** yenisiyle değiştir.
2. `chrome://extensions` sayfasında MarkaClip kartındaki ↻ (yenile) ikonuna tıkla.

## Sorun giderme

| Sorun | Çözüm |
| --- | --- |
| İkon görünmüyor | Instagram sekmesini yenile. Hâlâ yoksa `chrome://extensions` sayfasında eklentinin açık olduğunu kontrol et |
| "Oturum bulunamadı" hatası | instagram.com'a giriş yap |
| "MarkaClip güncellendi" hatası | Sayfayı yenile |
| Chrome açılışta "geliştirici modu uzantıları" uyarısı veriyor | Normal. Mağaza dışı kurulumlarda çıkar, **Kapat** demen yeterli |
