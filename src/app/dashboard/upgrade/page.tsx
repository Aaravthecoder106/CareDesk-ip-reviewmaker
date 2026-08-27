'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { Check, Star } from 'lucide-react'

export default function UpgradePage() {
  const { t } = useLanguage()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold sm:text-2xl">{t('upgrade.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('upgrade.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {/* Free Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('upgrade.basic')}</CardTitle>
            <p className="text-muted-foreground">{t('upgrade.basic.subtitle')}</p>
            <div className="mt-4 text-3xl font-bold">{t('upgrade.free')}</div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.basic.feature1')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.basic.feature2')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.basic.feature3')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.basic.feature4')}</li>
            </ul>
            <Button variant="outline" className="w-full" disabled>{t('upgrade.currentPlan')}</Button>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className="border-primary shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            {t('upgrade.recommended')}
          </div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              {t('upgrade.pro')} <Star className="size-5 text-yellow-500 fill-yellow-500" />
            </CardTitle>
            <p className="text-muted-foreground">{t('upgrade.pro.subtitle')}</p>
            <div className="mt-4 text-3xl font-bold">{t('upgrade.pro.price')}<span className="text-lg text-muted-foreground font-normal">{t('upgrade.pro.period')}</span></div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.pro.feature1')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.pro.feature2')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.pro.feature3')}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t('upgrade.pro.feature4')}</li>
            </ul>
            <Button className="w-full">{t('upgrade.pro.upgradeNow')}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
