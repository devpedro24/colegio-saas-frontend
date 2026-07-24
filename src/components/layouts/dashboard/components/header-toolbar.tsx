import { BellDot, Settings, Users, Clock, User, Bell, Keyboard, Gift, HelpCircle, LogOut, VolumeX, Download, ExternalLink, Sun, Moon, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { useIntl } from "react-intl";
import { toAbsoluteUrl } from "@/lib/helpers";
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

export function HeaderToolbar() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const currentLanguage = LANGUAGES.find((item) => item.code === locale) ?? LANGUAGES[0];

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <nav className="flex items-center gap-2.5">
      <Button variant="outline" className="bg-[#521AF2] text-white hover:bg-[#541af291] hover:text-white border-0">
        <Users className="size-4 text-white" />
        <span>{t('Add Teammate')}</span>
      </Button>
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
        <DropdownMenuContent className="w-64" side="bottom" align="end" sideOffset={11}>
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

          {/* Notificaciones y ajustes */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <VolumeX/>
              <span>{t('Mute notifications')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuItem>{t('For 30 minutes')}</DropdownMenuItem>
              <DropdownMenuItem>{t('For 1 hour')}</DropdownMenuItem>
              <DropdownMenuItem>{t('For 4 hours')}</DropdownMenuItem>
              <DropdownMenuItem>{t('Until tomorrow')}</DropdownMenuItem>
              <DropdownMenuItem>{t('Until next week')}</DropdownMenuItem>
              <DropdownMenuItem>{t('Custom date and time')}</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

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

          {/* Selector de idioma */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 [&_[data-slot=dropdown-menu-sub-trigger-indicator]]:hidden hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input">
              <Globe />
              <span className="flex items-center justify-between gap-2 grow relative">
                {t('Language')}
                <Badge
                  variant="outline"
                  className="absolute end-0 top-1/2 -translate-y-1/2"
                >
                  {currentLanguage.label}
                  <img
                    src={currentLanguage.flag}
                    className="w-3.5 h-3.5 rounded-full"
                    alt={currentLanguage.label}
                  />
                </Badge>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                {LANGUAGES.map((item) => (
                  <DropdownMenuRadioItem
                    key={item.code}
                    value={item.code}
                    className="flex items-center gap-2"
                  >
                    <img
                      src={item.flag}
                      className="w-4 h-4 rounded-full"
                      alt={item.label}
                    />
                    <span>{item.label}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

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
