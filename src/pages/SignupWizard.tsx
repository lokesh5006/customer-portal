import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Building2, Package, Users, FileText, CreditCard, UserPlus, Key } from 'lucide-react';
import { useApp, PRODUCT_CATALOG } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const PLAN_OPTIONS = [
  { id: 'annual', name: 'Annual Plan', description: 'Full annual subscription with all features', billingFrequency: 'annual' as const },
  { id: 'addon', name: 'Add-on Plan', description: 'Add specialized modules to your account', billingFrequency: 'annual' as const },
  { id: 'monthly', name: 'Monthly Plan', description: 'Flexible monthly billing', billingFrequency: 'monthly' as const },
];

const steps = [
  { id: 1, label: 'Company', icon: Building2 },
  { id: 2, label: 'Plan', icon: Package },
  { id: 3, label: 'Products', icon: Package },
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
      if (!wizardData.selectedSubscriptionPlan) newErrors.plan = 'Please select a subscription plan';
    }
    if (currentStep === 3) {
      if (wizardData.selectedProducts.length === 0) newErrors.products = 'Please select at least one product';
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
      completeSignup();
      toast({ title: 'Setup Complete!', description: 'Your account is ready. Welcome to NumberCruncher!' });
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
    else navigate('/');
  };

  const handlePayment = async () => {
    setPaymentStatus('processing');
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (Math.random() > 0.1) {
      setPaymentStatus('success');
      toast({ title: 'Payment Successful', description: 'Your subscription is now active.' });
      setTimeout(() => setCurrentStep(7), 1000);
    } else {
      setPaymentStatus('error');
    }
  };

  const totalPrice = wizardData.selectedProducts.reduce((a, p) => a + p.licenseCount * p.pricePerLicense, 0);

  const toggleProduct = (productName: string) => {
    const existing = wizardData.selectedProducts.find(p => p.productName === productName);
    if (existing) {
      updateWizardData({ selectedProducts: wizardData.selectedProducts.filter(p => p.productName !== productName) });
    } else {
      const cat = PRODUCT_CATALOG.find(c => c.name === productName);
      updateWizardData({ selectedProducts: [...wizardData.selectedProducts, { productName, licenseCount: 1, pricePerLicense: cat?.defaultPrice || 0 }] });
    }
  };

  const updateProductLicenses = (productName: string, count: number) => {
    updateWizardData({
      selectedProducts: wizardData.selectedProducts.map(p =>
        p.productName === productName ? { ...p, licenseCount: Math.max(1, Math.min(500, count)) } : p
      )
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2"><ArrowLeft className="h-4 w-4" />Back</Button>
          <div className="flex-1"><h1 className="text-lg font-semibold">Create Your Account</h1></div>
        </div>
      </div>

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
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className={cn('ml-2 text-sm hidden md:inline', currentStep === step.id ? 'text-foreground font-medium' : 'text-muted-foreground')}>{step.label}</span>
                {index < steps.length - 1 && <div className={cn('w-8 md:w-16 h-0.5 mx-2', currentStep > step.id ? 'bg-success' : 'bg-border')} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        {/* Step 1: Company Setup */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Company Setup</h2><p className="text-muted-foreground">Tell us about your company and create your account.</p></div>
            <Card><CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" placeholder="Acme Corporation" value={wizardData.companyName} onChange={(e) => updateWizardData({ companyName: e.target.value })} className={errors.companyName ? 'border-destructive' : ''} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={wizardData.firstName} onChange={(e) => updateWizardData({ firstName: e.target.value })} className={errors.firstName ? 'border-destructive' : ''} />
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={wizardData.lastName} onChange={(e) => updateWizardData({ lastName: e.target.value })} className={errors.lastName ? 'border-destructive' : ''} />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={wizardData.email} onChange={(e) => updateWizardData({ email: e.target.value })} className={errors.email ? 'border-destructive' : ''} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={wizardData.password} onChange={(e) => updateWizardData({ password: e.target.value })} className={errors.password ? 'border-destructive' : ''} />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
            </CardContent></Card>
          </div>
        )}

        {/* Step 2: Select Subscription Plan */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Select Subscription Plan</h2><p className="text-muted-foreground">Choose the plan type for your subscription.</p></div>
            <div className="grid gap-4">
              {PLAN_OPTIONS.map(plan => (
                <Card key={plan.id} className={cn('cursor-pointer card-hover transition-all', wizardData.selectedSubscriptionPlan === plan.name && 'card-selected')}
                  onClick={() => updateWizardData({ selectedSubscriptionPlan: plan.name })}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
                    </div>
                    {wizardData.selectedSubscriptionPlan === plan.name && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center"><Check className="h-4 w-4 text-primary-foreground" /></div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {errors.plan && <p className="text-sm text-destructive">{errors.plan}</p>}
          </div>
        )}

        {/* Step 3: Select Products */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Select Products</h2><p className="text-muted-foreground">Choose the products to include in your subscription.</p></div>
            <div className="grid gap-4">
              {PRODUCT_CATALOG.map(cat => {
                const isSelected = wizardData.selectedProducts.some(p => p.productName === cat.name);
                return (
                  <Card key={cat.name} className={cn('cursor-pointer card-hover transition-all', isSelected && 'card-selected')}
                    onClick={() => toggleProduct(cat.name)}>
                    <CardContent className="p-6 flex items-start gap-4">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(cat.name)} />
                      <div className="flex-1">
                        <h3 className="font-semibold">{cat.name}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{cat.description}</p>
                        <p className="text-primary font-semibold mt-2">${cat.defaultPrice}/license/year</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {errors.products && <p className="text-sm text-destructive">{errors.products}</p>}
          </div>
        )}

        {/* Step 4: License Quantity per Product */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">License Quantity</h2><p className="text-muted-foreground">Set the number of licenses for each product.</p></div>
            <div className="space-y-4">
              {wizardData.selectedProducts.map(prod => (
                <Card key={prod.productName}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{prod.productName}</h3>
                        <p className="text-sm text-muted-foreground">${prod.pricePerLicense}/license/year</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => updateProductLicenses(prod.productName, prod.licenseCount - 1)} disabled={prod.licenseCount <= 1}>-</Button>
                        <Input type="number" min={1} max={500} value={prod.licenseCount}
                          onChange={(e) => updateProductLicenses(prod.productName, parseInt(e.target.value) || 1)}
                          className="w-20 text-center font-semibold" />
                        <Button variant="outline" size="icon" onClick={() => updateProductLicenses(prod.productName, prod.licenseCount + 1)} disabled={prod.licenseCount >= 500}>+</Button>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      Subtotal: <span className="font-semibold text-foreground">${(prod.licenseCount * prod.pricePerLicense).toLocaleString()}/year</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="bg-muted/50 rounded-lg p-4 text-right">
                <span className="text-lg font-semibold">Total: <span className="text-primary">${totalPrice.toLocaleString()}/year</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Review Your Order</h2><p className="text-muted-foreground">Please review before proceeding.</p></div>
            <Card><CardContent className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Company</span><span className="font-medium">{wizardData.companyName}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Plan</span><span className="font-medium">{wizardData.selectedSubscriptionPlan}</span></div>
              <div className="py-2 border-b">
                <div className="text-muted-foreground mb-2">Products</div>
                {wizardData.selectedProducts.map(p => (
                  <div key={p.productName} className="flex justify-between text-sm ml-4 mb-1">
                    <span>{p.productName} – {p.licenseCount} licenses</span>
                    <span>${(p.licenseCount * p.pricePerLicense).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-2 text-lg font-semibold">
                <span>Total</span><span className="text-primary">${totalPrice.toLocaleString()}/year</span>
              </div>
            </CardContent></Card>
            <div className="flex items-start gap-3">
              <Checkbox id="terms" checked={wizardData.termsAccepted} onCheckedChange={(checked) => updateWizardData({ termsAccepted: checked as boolean })} />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </Label>
            </div>
            {errors.terms && <p className="text-sm text-destructive">{errors.terms}</p>}
          </div>
        )}

        {/* Step 6: Payment */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Payment</h2><p className="text-muted-foreground">Complete your purchase securely.</p></div>
            {paymentStatus === 'success' ? (
              <Card className="border-success"><CardContent className="p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><Check className="h-8 w-8 text-success" /></div>
                <h3 className="text-lg font-semibold text-success">Payment Successful!</h3>
                <p className="text-muted-foreground mt-2">Redirecting to setup...</p>
              </CardContent></Card>
            ) : paymentStatus === 'error' ? (
              <Card className="border-destructive"><CardContent className="p-6 text-center">
                <h3 className="text-lg font-semibold text-destructive">Payment Failed</h3>
                <Button onClick={() => setPaymentStatus('idle')} className="mt-4">Retry Payment</Button>
              </CardContent></Card>
            ) : paymentStatus === 'processing' ? (
              <Card><CardContent className="p-6 text-center">
                <CreditCard className="h-8 w-8 text-primary mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-semibold">Processing Payment...</h3>
              </CardContent></Card>
            ) : (
              <>
                <div className="flex gap-2 mb-4">
                  <Button variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')} className="flex-1">Pay by Card</Button>
                  <Button variant={paymentMethod === 'ach' ? 'default' : 'outline'} onClick={() => setPaymentMethod('ach')} className="flex-1">Pay by ACH</Button>
                </div>
                <Card><CardContent className="p-6 space-y-4">
                  {paymentMethod === 'card' ? (
                    <>
                      <div className="space-y-2"><Label>Card Number</Label><Input placeholder="4242 4242 4242 4242" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Expiry Date</Label><Input placeholder="MM/YY" /></div>
                        <div className="space-y-2"><Label>CVC</Label><Input placeholder="123" /></div>
                      </div>
                      <div className="space-y-2"><Label>Name on Card</Label><Input placeholder="John Doe" /></div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2"><Label>Bank Name</Label><Input placeholder="First National Bank" /></div>
                      <div className="space-y-2"><Label>Routing Number</Label><Input placeholder="021000021" /></div>
                      <div className="space-y-2"><Label>Account Number</Label><Input placeholder="1234567890" /></div>
                    </>
                  )}
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-semibold mb-4"><span>Total Due Today</span><span className="text-primary">${totalPrice.toLocaleString()}</span></div>
                    <Button className="w-full" onClick={handlePayment}>Pay Now</Button>
                  </div>
                </CardContent></Card>
              </>
            )}
          </div>
        )}

        {/* Step 7: Setup Users */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Setup Your Team</h2><p className="text-muted-foreground">Add team members to your account.</p></div>
            <Card className="border-success bg-success/5"><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-5 w-5 text-success" /></div>
              <div>
                <p className="font-medium">Subscription Active</p>
                <p className="text-sm text-muted-foreground">
                  {wizardData.selectedProducts.map(p => `${p.productName}: ${p.licenseCount} licenses`).join(' · ')}
                </p>
              </div>
            </CardContent></Card>
            <div className="bg-muted/50 rounded-lg p-4"><p className="text-sm text-muted-foreground">You can add more users now or skip and do it later from the Users page.</p></div>
          </div>
        )}

        {/* Step 8: Assign Licenses */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div><h2 className="text-2xl font-bold mb-2">Assign Licenses</h2><p className="text-muted-foreground">Assign licenses to your team members.</p></div>
            <Card className="bg-muted/50"><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">License Summary</p>
              {wizardData.selectedProducts.map(p => (
                <div key={p.productName} className="flex justify-between text-sm mt-1">
                  <span className="font-medium">{p.productName}</span>
                  <span>Purchased: {p.licenseCount} · Assigned: 1 · Available: {p.licenseCount - 1}</span>
                </div>
              ))}
            </CardContent></Card>
            <div className="bg-success/10 rounded-lg p-4 border border-success/20">
              <p className="text-sm text-success font-medium">✓ Your account is ready! Click "Complete Setup" to access your dashboard.</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          {currentStep !== 6 && (
            <Button onClick={handleNext}>{currentStep === 8 ? 'Complete Setup' : 'Continue'}<ArrowRight className="h-4 w-4 ml-2" /></Button>
          )}
        </div>
      </div>
    </div>
  );
};
