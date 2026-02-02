import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Building2, Package, Calendar, Users, FileText, CreditCard, UserPlus, Key } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const steps = [
  { id: 1, label: 'Company', icon: Building2 },
  { id: 2, label: 'Product', icon: Package },
  { id: 3, label: 'Term', icon: Calendar },
  { id: 4, label: 'Licenses', icon: Users },
  { id: 5, label: 'Review', icon: FileText },
  { id: 6, label: 'Payment', icon: CreditCard },
  { id: 7, label: 'Users', icon: UserPlus },
  { id: 8, label: 'Assign', icon: Key },
];

export const SignupWizard = () => {
  const navigate = useNavigate();
  const { wizardData, updateWizardData, completeSignup } = useApp();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach'>('card');

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!wizardData.companyName.trim()) newErrors.companyName = 'Company name is required';
      if (!wizardData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!wizardData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!wizardData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizardData.email)) newErrors.email = 'Invalid email format';
      if (!wizardData.password.trim()) newErrors.password = 'Password is required';
      else if (wizardData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (currentStep === 2) {
      if (!wizardData.selectedProduct) newErrors.product = 'Please select a product';
    }
    
    if (currentStep === 5) {
      if (!wizardData.termsAccepted) newErrors.terms = 'You must accept the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    
    if (currentStep < 8) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete wizard
      completeSignup();
      toast({
        title: 'Setup Complete!',
        description: 'Your account is ready. Welcome to NumberCruncher!',
      });
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate('/');
    }
  };

  const handlePayment = async () => {
    setPaymentStatus('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 90% success rate for demo
    if (Math.random() > 0.1) {
      setPaymentStatus('success');
      toast({
        title: 'Payment Successful',
        description: 'Your subscription is now active.',
      });
      setTimeout(() => {
        setCurrentStep(7);
      }, 1000);
    } else {
      setPaymentStatus('error');
    }
  };

  const totalPrice = wizardData.selectedSeats * 299;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Create Your Account</h1>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-all',
                  currentStep === step.id && 'wizard-step-active',
                  currentStep > step.id && 'wizard-step-completed',
                  currentStep < step.id && 'wizard-step-pending'
                )}>
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className={cn(
                  'ml-2 text-sm hidden md:inline',
                  currentStep === step.id ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'w-8 md:w-16 h-0.5 mx-2',
                    currentStep > step.id ? 'bg-success' : 'bg-border'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        {/* Step 1: Company Setup */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Company Setup</h2>
              <p className="text-muted-foreground">Tell us about your company and create your account.</p>
            </div>
            
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Corporation"
                    value={wizardData.companyName}
                    onChange={(e) => updateWizardData({ companyName: e.target.value })}
                    className={errors.companyName ? 'border-destructive' : ''}
                  />
                  {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={wizardData.firstName}
                      onChange={(e) => updateWizardData({ firstName: e.target.value })}
                      className={errors.firstName ? 'border-destructive' : ''}
                    />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={wizardData.lastName}
                      onChange={(e) => updateWizardData({ lastName: e.target.value })}
                      className={errors.lastName ? 'border-destructive' : ''}
                    />
                    {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@acme.com"
                    value={wizardData.email}
                    onChange={(e) => updateWizardData({ email: e.target.value })}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={wizardData.password}
                    onChange={(e) => updateWizardData({ password: e.target.value })}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Choose Product */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Choose Your Product</h2>
              <p className="text-muted-foreground">Select the product that best fits your needs.</p>
            </div>
            
            <div className="grid gap-4">
              <Card
                className={cn(
                  'cursor-pointer card-hover transition-all',
                  wizardData.selectedProduct === 'NumberCruncher Desktop' && 'card-selected'
                )}
                onClick={() => updateWizardData({ selectedProduct: 'NumberCruncher Desktop' })}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">NumberCruncher Desktop</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Full-featured desktop application for professional accounting and tax preparation.
                    </p>
                    <p className="text-primary font-semibold mt-2">$299/seat/year</p>
                  </div>
                  {wizardData.selectedProduct === 'NumberCruncher Desktop' && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer card-hover transition-all',
                  wizardData.selectedProduct === 'NumberCruncher Web' && 'card-selected'
                )}
                onClick={() => updateWizardData({ selectedProduct: 'NumberCruncher Web' })}
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-info" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">NumberCruncher Web</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Cloud-based solution accessible from any browser, perfect for remote teams.
                    </p>
                    <p className="text-primary font-semibold mt-2">$249/seat/year</p>
                  </div>
                  {wizardData.selectedProduct === 'NumberCruncher Web' && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {errors.product && <p className="text-sm text-destructive">{errors.product}</p>}
          </div>
        )}

        {/* Step 3: Choose Term */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Subscription Term</h2>
              <p className="text-muted-foreground">Select your billing cycle.</p>
            </div>
            
            <Card className="card-selected">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Annual Subscription</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Calendar-based renewal billed in December
                    </p>
                  </div>
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> All subscriptions renew annually on a calendar-year basis. 
                You will be billed for the upcoming year each December.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Choose Licenses */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">License Quantity</h2>
              <p className="text-muted-foreground">How many user licenses do you need?</p>
            </div>
            
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateWizardData({ selectedSeats: Math.max(1, wizardData.selectedSeats - 1) })}
                    disabled={wizardData.selectedSeats <= 1}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={wizardData.selectedSeats}
                    onChange={(e) => updateWizardData({ 
                      selectedSeats: Math.min(500, Math.max(1, parseInt(e.target.value) || 1)) 
                    })}
                    className="w-24 text-center text-lg font-semibold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateWizardData({ selectedSeats: Math.min(500, wizardData.selectedSeats + 1) })}
                    disabled={wizardData.selectedSeats >= 500}
                  >
                    +
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price per seat</span>
                    <span>$299/year</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Number of seats</span>
                    <span>{wizardData.selectedSeats}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total Annual Price</span>
                    <span className="text-primary">${totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                You can add more licenses later from your subscription settings.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Review Your Order</h2>
              <p className="text-muted-foreground">Please review your order details before proceeding.</p>
            </div>
            
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{wizardData.companyName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{wizardData.selectedProduct}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Term</span>
                  <span className="font-medium">Annual</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Seats</span>
                  <span className="font-medium">{wizardData.selectedSeats}</span>
                </div>
                <div className="flex justify-between py-2 text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">${totalPrice.toLocaleString()}/year</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={wizardData.termsAccepted}
                onCheckedChange={(checked) => updateWizardData({ termsAccepted: checked as boolean })}
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </Label>
            </div>
            {errors.terms && <p className="text-sm text-destructive">{errors.terms}</p>}
          </div>
        )}

        {/* Step 6: Payment */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Payment</h2>
              <p className="text-muted-foreground">Complete your purchase securely.</p>
            </div>

            {paymentStatus === 'success' ? (
              <Card className="border-success">
                <CardContent className="p-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-success">Payment Successful!</h3>
                  <p className="text-muted-foreground mt-2">Redirecting to setup...</p>
                </CardContent>
              </Card>
            ) : paymentStatus === 'error' ? (
              <Card className="border-destructive">
                <CardContent className="p-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✕</span>
                  </div>
                  <h3 className="text-lg font-semibold text-destructive">Payment Failed</h3>
                  <p className="text-muted-foreground mt-2">Your payment could not be processed. Please try again.</p>
                  <Button onClick={() => setPaymentStatus('idle')} className="mt-4">
                    Retry Payment
                  </Button>
                </CardContent>
              </Card>
            ) : paymentStatus === 'processing' ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                    <CreditCard className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Processing Payment...</h3>
                  <p className="text-muted-foreground mt-2">Please wait while we process your payment.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Payment Method Selection */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={paymentMethod === 'card' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('card')}
                    className="flex-1"
                  >
                    Pay by Card
                  </Button>
                  <Button
                    variant={paymentMethod === 'ach' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('ach')}
                    className="flex-1"
                  >
                    Pay by ACH
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    {paymentMethod === 'card' ? (
                      <>
                        <div className="space-y-2">
                          <Label>Card Number</Label>
                          <Input placeholder="4242 4242 4242 4242" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Expiry Date</Label>
                            <Input placeholder="MM/YY" />
                          </div>
                          <div className="space-y-2">
                            <Label>CVC</Label>
                            <Input placeholder="123" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Name on Card</Label>
                          <Input placeholder="John Doe" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Bank Name</Label>
                          <Input placeholder="First National Bank" />
                        </div>
                        <div className="space-y-2">
                          <Label>Routing Number</Label>
                          <Input placeholder="021000021" />
                        </div>
                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input placeholder="1234567890" />
                        </div>
                      </>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex justify-between font-semibold mb-4">
                        <span>Total Due Today</span>
                        <span className="text-primary">${totalPrice.toLocaleString()}</span>
                      </div>
                      <Button className="w-full" onClick={handlePayment}>
                        Pay Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Step 7: Setup Users */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Setup Your Team</h2>
              <p className="text-muted-foreground">Add team members to your account.</p>
            </div>

            <Card className="border-success bg-success/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Subscription Active</p>
                  <p className="text-sm text-muted-foreground">
                    Seats purchased: {wizardData.selectedSeats} | Available: {wizardData.selectedSeats - 1}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-semibold text-primary">
                      {wizardData.firstName.charAt(0)}{wizardData.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{wizardData.firstName} {wizardData.lastName}</p>
                    <p className="text-sm text-muted-foreground">{wizardData.email}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Account Owner</span>
                  <span className="text-xs bg-success/10 text-success px-2 py-1 rounded">License Assigned</span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                You can add more users now or skip and do it later from the Users page.
              </p>
            </div>
          </div>
        )}

        {/* Step 8: Assign Licenses */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Assign Licenses</h2>
              <p className="text-muted-foreground">Assign licenses to your team members.</p>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">License Summary</p>
                  <p className="font-semibold">
                    Purchased: {wizardData.selectedSeats} | Assigned: 1 | Available: {wizardData.selectedSeats - 1}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-semibold text-primary">
                      {wizardData.firstName.charAt(0)}{wizardData.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{wizardData.firstName} {wizardData.lastName}</p>
                    <p className="text-sm text-muted-foreground">{wizardData.email}</p>
                  </div>
                  <span className="text-xs bg-success/10 text-success px-2 py-1 rounded">✓ Assigned</span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-success/10 rounded-lg p-4 border border-success/20">
              <p className="text-sm text-success font-medium">
                ✓ Your account is ready! Click "Complete Setup" to access your dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {currentStep !== 6 && (
            <Button onClick={handleNext}>
              {currentStep === 8 ? 'Complete Setup' : 'Continue'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
