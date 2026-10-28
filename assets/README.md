# Логотип slidemachina

Основной вариант — знак со стопкой слайдов и надписью Plus Jakarta Sans SemiBold (600). Надпись переведена в кривые: устанавливать шрифт не нужно. Фон всех SVG прозрачный.

| Файл | Где использовать |
| --- | --- |
| `logo-light.svg` | Полный логотип на светлом фоне |
| `logo-on-dark.svg` | Полный логотип на тёмном фоне |
| `icon-color.svg` | Синий знак без надписи: иконки и аватар репозитория |
| `icon-dark.svg` | Одноцветный тёмный знак |
| `icon-white.svg` | Белый знак на тёмном фоне |

Эти файлы — исходники для README, аватара репозитория и других мест вне слайдов. На слайдах логотип рисует компонент движка `Machina.SlidemachinaLogo` (`packages/slidemachina/browser-runtime/presentation-core/slidemachina-logo.tsx`). Если меняете логотип, обновите и его, и иконку вкладки в `packages/slidemachina/server-runtime/development-server/slidemachina-favicon.svg` с PNG рядом. Примеры с общей темой и шаблон новой презентации используют собственные логотипы.

Шрифт: [Plus Jakarta Sans](https://github.com/google/fonts/tree/main/ofl/plusjakartasans), лицензия SIL Open Font License 1.1, см. `font-license.txt`.
