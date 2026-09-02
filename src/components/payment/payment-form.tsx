'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface PaymentProps {
  userId: string;
  planType: 'monthly' | 'annual';
  onSuccess?: () => void;
}

export function PaymentForm({ userId, planType, onSuccess }: PaymentProps) {
  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transactionId.trim()) {
      toast({
        title: 'Transaction ID Required',
        description: 'Please enter the transaction reference ID from your UPI payment.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          plan_type: planType,
          transaction_id: transactionId.trim(),
          payment_method: 'UPI_MANUAL',
          amount: planType === 'monthly' ? 499 : 4999,
          currency: 'INR',
          status: 'pending_verification',
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Payment Submitted!',
        description: 'Your transaction ID has been recorded. We\'ll verify it within 24 hours.',
      });

      onSuccess?.();
    } catch (error) {
      console.error('Payment submission error:', error);
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit transaction ID. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Payment Submitted!</CardTitle>
          <CardDescription>
            Transaction ID: <strong>{transactionId}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Our team will verify your payment within 24 hours. You'll receive a confirmation email once verified.
          </p>
          <Button className="w-full" onClick={onSuccess}>
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <CardDescription>
          Scan the QR code below to pay via UPI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-64 h-64 bg-white p-4 rounded-lg shadow-lg border">
            <img
              src="/qr_code.jpeg"
              alt="UPI Payment QR Code"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"%3E%3Crect fill="%23f3f4f6" width="256" height="256"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%236b7280"%3EQR Code Image%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
          <div className="text-center space-y-2">
            <p className="font-medium">Scan to Pay</p>
            <p className="text-sm text-muted-foreground">
              Amount: <span className="font-semibold">{planType === 'monthly' ? '₹499/month' : '₹4,999/year'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: GPay, PhonePe, Paytm, BHIM, and all UPI apps
            </p>
          </div>
        </div>

        {/* Transaction ID Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transactionId">Transaction Reference ID</Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g., UPI/123456789012/SBIBINR"
              disabled={isSubmitting}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Find this in your UPI app payment confirmation
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !transactionId.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Transaction ID
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* International Payment */}
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium mb-2">International Users</p>
            <p className="text-xs text-muted-foreground mb-3">
              Pay securely via PayPal or Buy Me A Coffee
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open('https://buymeacoffee.com/caredesk', '_blank')}
          >
            🌍 International: Pay Here
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            After payment, email your receipt to support@caredesk.com with your account email
          </p>
        </div>

        {/* Security Notice */}
        <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium">Secure Payment</p>
            <p>Your transaction ID is encrypted and stored securely.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
