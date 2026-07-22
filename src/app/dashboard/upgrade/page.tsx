import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Star } from 'lucide-react'

export default function UpgradePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold sm:text-2xl">Upgrade to CareDesk Pro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlock premium features and get the most out of your health data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {/* Free Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Basic</CardTitle>
            <p className="text-muted-foreground">For individuals</p>
            <div className="mt-4 text-3xl font-bold">Free</div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Store up to 10 reports</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Basic AI Analysis</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Standard Analytics</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> 1 Family Member</li>
            </ul>
            <Button variant="outline" className="w-full" disabled>Current Plan</Button>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className="border-primary shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            RECOMMENDED
          </div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              Pro <Star className="size-5 text-yellow-500 fill-yellow-500" />
            </CardTitle>
            <p className="text-muted-foreground">For ultimate peace of mind</p>
            <div className="mt-4 text-3xl font-bold">$10<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Unlimited report storage</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Priority AI Analysis</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Advanced Analytics & Trend Tracking</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Unlimited Family Members</li>
            </ul>
            <Button className="w-full">Upgrade Now</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
