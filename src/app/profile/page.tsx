"use client";

import { useState } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { roleLabels } from "@/lib/permissions";
import {
  UserCircle,
  Save,
  Lock,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function ProfilePage() {
  const { firebaseUser, userData } = useAuth();

  // Profile form state
  const [name, setName] = useState(userData?.name || "");
  const [phone, setPhone] = useState(userData?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSaveProfile = async () => {
    if (!firebaseUser || !name.trim()) return;
    setSavingProfile(true);
    setProfileSaved(false);

    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name: name.trim(),
        phone: phone.trim() || null,
        updatedAt: Timestamp.now(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (!firebaseUser || !firebaseUser.email) return;
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      // Re-authenticate
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/wrong-password") {
        setPasswordError("Current password is incorrect.");
      } else if (err.code === "auth/requires-recent-login") {
        setPasswordError("Please sign out and sign back in before changing your password.");
      } else {
        setPasswordError(err.message || "Failed to change password.");
      }
    }
    setChangingPassword(false);
  };

  if (!userData) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
          My Profile
        </h1>
        <p className="text-clay-500 mt-1">
          Manage your account settings and personal information
        </p>
      </div>

      {/* Profile Image & Role */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-gold/20 text-gold-dark text-2xl font-bold">
              {userData.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-display font-semibold text-clay-700">
              {userData.name}
            </h2>
            <p className="text-sm text-clay-400">{userData.email}</p>
            <Badge variant="gold" className="mt-2">
              <Shield className="mr-1 h-3 w-3" />
              {roleLabels[userData.role]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-clay-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
              <Input
                id="email"
                value={userData.email}
                disabled
                className="pl-9 bg-clay-50"
              />
            </div>
            <p className="text-xs text-clay-400">
              Email cannot be changed. Contact admin for assistance.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., +27 82 123 4567"
                className="pl-9"
              />
            </div>
          </div>

          {profileSaved && (
            <div className="flex items-center gap-2 text-teal text-sm">
              <CheckCircle className="h-4 w-4" />
              Profile updated successfully!
            </div>
          )}

          <Button
            variant="gold"
            onClick={handleSaveProfile}
            disabled={!name.trim() || savingProfile}
          >
            {savingProfile ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-clay-500" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password. You will need your current password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 text-teal text-sm">
              <CheckCircle className="h-4 w-4" />
              Password changed successfully!
            </div>
          )}

          <Button
            variant="default"
            onClick={handleChangePassword}
            disabled={
              !currentPassword || !newPassword || !confirmPassword || changingPassword
            }
          >
            {changingPassword ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
