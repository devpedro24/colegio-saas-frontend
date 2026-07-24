import { BellDot, Settings, Clock, User, Bell, Keyboard, Gift, HelpCircle, LogOut, VolumeX, Download, ExternalLink, Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useIntl } from "react-intl";
import { toAbsoluteUrl } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n/i18n-context";
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarIndicator,
  AvatarStatus,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LANGUAGES = LOCALES.map((code) => ({
  code,
  label: LOCALE_LABELS[code],
  flag: toAbsoluteUrl(LOCALE_FLAGS[code]),
}));

// Panel flotante que se sobrepone hacia abajo (usado solo en pantallas pequeñas).
const FLOATING_PANEL =
  'absolute start-0 top-full z-50 mt-1 min-w-full max-w-[calc(100vw-1rem)] space-y-0.5 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md shadow-black/5';

export function HeaderToolbar() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const isMobile = useIsMobile();
  const [muteOpen, setMuteOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const currentLanguage = LANGUAGES.find((item) => item.code === locale) ?? LANGUAGES[0];

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Opciones (se reutilizan en el flyout de desktop y en el panel de móvil).
  const muteItems = (
    <>
      <DropdownMenuItem>{t('For 30 minutes')}</DropdownMenuItem>
      <DropdownMenuItem>{t('For 1 hour')}</DropdownMenuItem>
      <DropdownMenuItem>{t('For 4 hours')}</DropdownMenuItem>
      <DropdownMenuItem>{t('Until tomorrow')}</DropdownMenuItem>
      <DropdownMenuItem>{t('Until next week')}</DropdownMenuItem>
      <DropdownMenuItem>{t('Custom date and time')}</DropdownMenuItem>
    </>
  );

  const languageItems = (
    <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
      {LANGUAGES.map((item) => (
        <DropdownMenuRadioItem key={item.code} value={item.code} className="flex items-center gap-2">
          <img src={item.flag} className="w-4 h-4 rounded-full" alt={item.label} />
          <span>{item.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  const languageTrigger = (
    <>
      <Globe />
      <span className="flex items-center justify-between gap-2 grow relative">
        {t('Language')}
        <Badge variant="outline" className="absolute end-0 top-1/2 -translate-y-1/2">
          {currentLanguage.label}
          <img src={currentLanguage.flag} className="w-3.5 h-3.5 rounded-full" alt={currentLanguage.label} />
        </Badge>
      </span>
    </>
  );

  return (
    <nav className="flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white hover:bg-[#26272F]">
          <BellDot className="opacity-100" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white hover:bg-[#26272F]">
          <Settings className="opacity-100" />
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer">
          <Avatar className="size-7">
            <AvatarImage src={toAbsoluteUrl('/media/avatars/300-2.png')} alt="Avatar" />
            <AvatarFallback>CH</AvatarFallback>
            <AvatarIndicator className="-end-2 -top-2">
              <AvatarStatus variant="online" className="size-2.5" />
            </AvatarIndicator>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-lg:overflow-visible" side="bottom" align="end" sideOffset={11}>
          {/* Datos del usuario */}
          <div className="flex items-center gap-3 p-3">
            <Avatar>
              <AvatarImage src={toAbsoluteUrl('/media/avatars/300-2.png')} alt="Avatar" />
              <AvatarFallback>S</AvatarFallback>
              <AvatarIndicator className="-end-1.5 -top-1.5">
                <AvatarStatus variant="online" className="size-2.5" />
              </AvatarIndicator>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Sean</span>
              <span className="text-xs text-muted-foreground">{t('Online')}</span>
            </div>
          </div>

          <DropdownMenuItem className="cursor-pointer py-1 rounded-md border border-border hover:bg-muted">
            <Clock/>
            <span>{t('Set status')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Silenciar notificaciones: flyout lateral en desktop, panel hacia abajo en pantallas pequeñas */}
          {isMobile ? (
            <div
              className="relative"
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setMuteOpen(true); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse') setMuteOpen(false); }}
            >
              <DropdownMenuItem
                data-state={muteOpen ? 'open' : 'closed'}
                onSelect={(event) => {
                  event.preventDefault();
                  setMuteOpen((value) => !value);
                }}
              >
                <VolumeX />
                <span>{t('Mute notifications')}</span>
                <ChevronDown className={cn('ms-auto size-3.5 shrink-0 opacity-60 transition-transform', muteOpen && 'rotate-180')} />
              </DropdownMenuItem>
              {muteOpen && <div className={FLOATING_PANEL}>{muteItems}</div>}
            </div>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <VolumeX />
                <span>{t('Mute notifications')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">{muteItems}</DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuItem>
            <User/>
            <span>{t('Profile')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Settings/>
            <span>{t('Settings')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Bell/>
            <span>{t('Notification settings')}</span>
          </DropdownMenuItem>

          {/* Selector de idioma: flyout lateral en desktop, panel hacia abajo en pantallas pequeñas */}
          {isMobile ? (
            <div
              className="relative"
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setLangOpen(true); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse') setLangOpen(false); }}
            >
              <DropdownMenuItem
                data-state={langOpen ? 'open' : 'closed'}
                className="hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input"
                onSelect={(event) => {
                  event.preventDefault();
                  setLangOpen((value) => !value);
                }}
              >
                {languageTrigger}
                <ChevronDown className={cn('ms-auto size-3.5 shrink-0 opacity-60 transition-transform', langOpen && 'rotate-180')} />
              </DropdownMenuItem>
              {langOpen && <div className={FLOATING_PANEL}>{languageItems}</div>}
            </div>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 [&_[data-slot=dropdown-menu-sub-trigger-indicator]]:hidden hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input">
                {languageTrigger}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">{languageItems}</DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />

          {/* Tema */}
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <span>{theme === "light" ? t('Dark mode') : t('Light mode')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <Keyboard/>
            <span>{t('Keyboard shortcuts')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Gift/>
            <span>{t('Referrals')}</span>
            <Badge variant="info" appearance="light" className="ms-auto">{t('New')}</Badge>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Download/>
            <span>{t('Download apps')}</span>
            <ExternalLink className="size-3 ms-auto" />
          </DropdownMenuItem>

          <DropdownMenuItem>
            <HelpCircle/>
            <span>{t('Help')}</span>
            <ExternalLink className="size-3 ms-auto" />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <LogOut/>
            <span>{t('Log out')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
