"use client";

import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { Grid } from "@giphy/react-components";
import {
  CheckSquare,
  ChevronDown,
  Copy,
  Forward,
  Gift,
  Paperclip,
  PenSquare,
  Pin,
  Plus,
  Reply,
  Smile,
  Square,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/components/providers/SessionProvider";
import { socket } from "@/lib/socket-client";

type UserType = {
  _id: string;
  name: string;
  savedName?: string;
  accountName?: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  isOnline?: boolean;
};

type MessageType = {
  _id: string;
  text?: string;
  image?: string;
  createdAt: string;
  deliveredTo?: string[];
  seenBy?: string[];
  starred?: boolean;
  edited?: boolean;
  deletedForEveryone?: boolean;
  replyTo?: {
    _id: string;
    text?: string;
    image?: string;
    deletedForEveryone?: boolean;
    sender?: {
      _id?: string;
      name?: string;
      avatar?: string;
    };
  } | null;
  sender: {
    _id?: string;
    name: string;
    email: string;
    avatar?: string;
  };
};

type ConversationType = {
  _id: string;
  participants: Array<UserType | null | undefined>;
  lastMessage?: {
    _id: string;
    text?: string;
    image?: string;
  } | null;
  pinnedMessage?: MessageType | null;
  updatedAt?: string;
  unreadCount?: number;
};

type ReceiveMessagePayload = {
  _id?: string;
  conversationId: string;
  text?: string;
  image?: string;
  createdAt?: string;
  deliveredTo?: string[];
  seenBy?: string[];
  starred?: boolean;
  edited?: boolean;
  deletedForEveryone?: boolean;
  replyTo?: MessageType["replyTo"];
  sender: {
    _id?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
};

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

type GiphyGif = {
  images?: {
    original?: {
      url?: string;
    };
  };
};

const EMPTY_GIFS_RESULT = {
  data: [],
  pagination: { total_count: 0, count: 0, offset: 0 },
  meta: { status: 200, msg: "OK", response_id: "local-empty" },
};

type PendingAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};

type ProfileType = {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  twoFactorEnabled?: boolean;
};

type TwoFactorSetupState = {
  qrCodeDataUrl: string;
  manualKey: string;
};

type PasskeySummary = {
  credentialID: string;
  label: string;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string[];
  createdAt?: string;
};

export default function ChatPage() {
  const { data: session, status: sessionStatus, signOut } = useAuth();

  const [users, setUsers] = useState<UserType[]>([]);
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [profileBio, setProfileBio] = useState("");
  const [profileStatus, setProfileStatus] = useState("Available");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [editingProfileField, setEditingProfileField] = useState<
    "" | "photo" | "phone" | "status" | "bio" | "twoFactor"
  >("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupState | null>(
    null,
  );
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [twoFactorDisableMethod, setTwoFactorDisableMethod] = useState<
    "authenticator" | "email"
  >("authenticator");
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);
  const [sendingDisableTwoFactorEmailOtp, setSendingDisableTwoFactorEmailOtp] =
    useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [savingPasskey, setSavingPasskey] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [removingPasskeyId, setRemovingPasskeyId] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showSecurityView, setShowSecurityView] = useState(false);
  const [showContactsView, setShowContactsView] = useState(false);
  const [showAddContactView, setShowAddContactView] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [addContactName, setAddContactName] = useState("");
  const [addContactPhone, setAddContactPhone] = useState("");
  const [contactSavedName, setContactSavedName] = useState("");
  const [editingContactSavedName, setEditingContactSavedName] = useState(false);
  const [savingContactName, setSavingContactName] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUserName, setTypingUserName] = useState("");
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchTerm, setGifSearchTerm] = useState("");
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<MessageType | null>(
    null,
  );
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingImagePreview, setEditingImagePreview] = useState("");
  const [messageMenuId, setMessageMenuId] = useState("");
  const [deleteOptionsMessageId, setDeleteOptionsMessageId] = useState("");
  const [conversationMenuId, setConversationMenuId] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<MessageType | null>(
    null,
  );
  const [forwardingSelectedMessages, setForwardingSelectedMessages] =
    useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedConversationIdRef = useRef("");
  const selectedUserIdRef = useRef("");
  const composerRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const currentUserId = session?.user?.id || "";
  const currentUserName = session?.user?.name || "You";
  const currentUserEmail = session?.user?.email || "";
  const giphyApiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  const deferredGifSearchTerm = useDeferredValue(gifSearchTerm.trim());

  const openProfileView = useCallback(() => {
    setShowAccountMenu(false);
    setShowSecurityView(false);
    setShowContactsView(false);
    setShowAddContactView(false);
    setShowContactDetails(false);
    setShowProfileEditor(true);
  }, []);

  const openSecurityView = useCallback(() => {
    setShowAccountMenu(false);
    setShowProfileEditor(false);
    setShowContactsView(false);
    setShowAddContactView(false);
    setShowContactDetails(false);
    setShowSecurityView(true);
  }, []);

  const giphyFetch = useMemo(() => {
    return giphyApiKey ? new GiphyFetch(giphyApiKey) : null;
  }, [giphyApiKey]);

  const normalizeId = useCallback((value: unknown) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "_id" in value) {
      return normalizeId((value as { _id?: unknown })._id);
    }
    return String(value);
  }, []);

  const contactsById = useMemo(
    () =>
      new Map(
        users
          .map((user) => [normalizeId(user._id), user] as const)
          .filter(([userId]) => Boolean(userId)),
      ),
    [normalizeId, users],
  );

  const getDisplayName = useCallback(
    (
      user:
        | Pick<UserType, "_id" | "name" | "savedName">
        | Pick<MessageType["sender"], "_id" | "name">
        | null
        | undefined,
    ) => {
      if (!user) return "Unknown";

      const savedContact = contactsById.get(normalizeId(user._id));

      return (
        savedContact?.savedName?.trim() ||
        savedContact?.name?.trim() ||
        user.savedName?.trim() ||
        user.name?.trim() ||
        "Unknown"
      );
    },
    [contactsById, normalizeId],
  );

  const isSavedContact = useCallback(
    (
      user:
        | Pick<UserType, "_id">
        | Pick<MessageType["sender"], "_id">
        | null
        | undefined,
    ) => {
      return contactsById.has(normalizeId(user?._id));
    },
    [contactsById, normalizeId],
  );

  const getPhoneDisplayName = useCallback(
    (user: UserType | null | undefined) => {
      if (!user) return "Unknown";
      if (isSavedContact(user)) {
        return getDisplayName(user);
      }
      return user.phone?.trim() || getDisplayName(user);
    },
    [getDisplayName, isSavedContact],
  );

  const getAccountName = useCallback(
    (
      user:
        | Pick<UserType, "_id" | "name" | "accountName">
        | Pick<MessageType["sender"], "_id" | "name">
        | null
        | undefined,
    ) => {
      if (!user) return "";

      const savedContact = contactsById.get(normalizeId(user._id));

      return (
        savedContact?.accountName?.trim() ||
        user.accountName?.trim() ||
        user.name?.trim() ||
        ""
      );
    },
    [contactsById, normalizeId],
  );

  const withSavedContactName = useCallback(
    (user: UserType | null | undefined) => {
      if (!user?._id) return user ?? null;

      const savedContact = contactsById.get(normalizeId(user._id));
      if (!savedContact) {
        return user;
      }

      return {
        ...user,
        ...savedContact,
        name: getDisplayName(savedContact),
        savedName: savedContact.savedName || savedContact.name,
        accountName: savedContact.accountName || user.name,
      };
    },
    [contactsById, getDisplayName, normalizeId],
  );

  const showStatus = useCallback((message: string, duration = 3200) => {
    setStatus(message);

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = setTimeout(() => {
      setStatus("");
      statusTimeoutRef.current = null;
    }, duration);
  }, []);

  const closeChat = () => {
    setSelectedConversationId("");
    setSelectedUserId("");
    setMessages([]);
    setMessageText("");
    setTypingUserName("");
    setShowContactsView(false);
    setShowAddContactView(false);
    setShowContactDetails(false);
    setAddContactName("");
    setShowComposerMenu(false);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setGifSearchTerm("");
    setPendingAttachment(null);
    setReplyingToMessage(null);
    setEditingMessageId("");
    setEditingImagePreview("");
    setMessageMenuId("");
    setDeleteOptionsMessageId("");
    setConversationMenuId("");
    setSelectedMessageIds([]);
    setForwardingMessage(null);
    setForwardingSelectedMessages(false);
    showStatus("Chat closed");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to load profile");
        return;
      }

      const nextProfile = data.profile as ProfileType;
      setProfile(nextProfile);
      setProfileBio(nextProfile.bio || "");
      setProfileStatus(nextProfile.status || "Available");
      setProfilePhone(nextProfile.phone || "");
      setProfileAvatar(nextProfile.avatar || "");
    } catch {
      showStatus("Failed to load profile");
    }
  }, [showStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setShowAccountMenu(false);
      }

      if (
        composerRef.current &&
        !composerRef.current.contains(event.target as Node)
      ) {
        setShowComposerMenu(false);
        setShowEmojiPicker(false);
        setShowGifPicker(false);
      }

      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-message-menu-root]")) {
        setMessageMenuId("");
        setDeleteOptionsMessageId("");
      }

      if (!target?.closest("[data-conversation-menu-root]")) {
        setConversationMenuId("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : "";

      if (!dataUrl) {
        showStatus("Could not read attachment");
        return;
      }

      setPendingAttachment({
        name: file.name,
        type: file.type,
        dataUrl,
      });
      setShowComposerMenu(false);
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      showStatus("Attachment ready");
    };

    reader.onerror = () => {
      showStatus("Could not read attachment");
    };

    reader.readAsDataURL(file);
  };

  const { getInputProps, open: openAttachmentPicker } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
    },
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);

      const res = await fetch("/api/users");
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to load contacts");
        return;
      }

      setUsers(data.users || []);
    } catch {
      showStatus("Failed to load contacts");
    } finally {
      setLoadingUsers(false);
    }
  }, [showStatus]);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);

      const res = await fetch("/api/conversations");
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to load conversations");
        return;
      }

      setConversations(data.conversations || []);
    } catch {
      showStatus("Failed to load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, [showStatus]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      if (!conversationId) return;

        setLoadingMessages(true);
      setTypingUserName("");
      setMessageMenuId("");
      setDeleteOptionsMessageId("");
      setConversationMenuId("");
      setSelectedMessageIds([]);
        setForwardingSelectedMessages(false);
        setShowAccountMenu(false);
        setShowProfileEditor(false);
        setShowSecurityView(false);
        setShowContactsView(false);
      setShowAddContactView(false);
      setShowContactDetails(false);

      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      const data = await res.json();

      if (!res.ok) {
        console.error("loadMessages error:", data);
        showStatus(data.message || "Failed to load messages");
        return;
      }

      const fetchedMessages: MessageType[] = data.messages || [];

      setMessages(fetchedMessages);
      setSelectedConversationId(conversationId);
      showStatus("Conversation loaded");

      // ✅ Emit delivered + seen
      fetchedMessages.forEach((message) => {
        if (message.sender?._id && message.sender._id !== currentUserId) {
          socket.emit("message-delivered", {
            senderId: message.sender._id,
            messageId: message._id,
            conversationId,
          });

          socket.emit("message-seen", {
            senderId: message.sender._id,
            messageId: message._id,
            conversationId,
          });
        }
      });

      // ✅ Refresh unread count AFTER marking seen
      await loadConversations();
    } catch {
      showStatus("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUserId, loadConversations, showStatus]);
  
  const createConversation = async (receiverId: string, skipLoad = false) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiverId }),
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to create conversation");
        return;
      }

      const conversationId = data.conversation?._id;

      if (!conversationId) {
        showStatus("Conversation ID not found");
        return;
      }

        setSelectedConversationId(conversationId);
        setSelectedUserId(receiverId);
        setShowAccountMenu(false);
        setShowProfileEditor(false);
        setShowSecurityView(false);
        setShowContactsView(false);
      setShowAddContactView(false);

      if (!skipLoad) {
        await loadConversations();
        await loadMessages(conversationId);
      }

      return conversationId as string;
    } catch {
      showStatus("Failed to create conversation");
    }
    return null;
  };

  const sendMessage = async () => {
    await sendPayload({
      text: messageText.trim() || undefined,
      image: pendingAttachment?.dataUrl,
    });
  };

  const handleProfilePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : "";

      if (!dataUrl) {
        showStatus("Could not read profile image");
        return;
      }

      setProfileAvatar(dataUrl);
      showStatus("Profile photo ready");
    };

    reader.onerror = () => {
      showStatus("Could not read profile image");
    };

    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatar: profileAvatar,
          bio: profileBio,
          phone: profilePhone,
          status: profileStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const fieldErrors = data?.errors?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const validationMessage = fieldErrors
          ? Object.values(fieldErrors).flat().find(Boolean)
          : "";

        showStatus(
          validationMessage || data.message || "Failed to save profile",
        );
        return;
      }

      const updatedProfile = data.profile as ProfileType;

      setProfile(updatedProfile);
      setProfileAvatar(updatedProfile.avatar || "");
      setProfileBio(updatedProfile.bio || "");
      setProfilePhone(updatedProfile.phone || "");
      setProfileStatus(updatedProfile.status || "Available");
      setEditingProfileField("");
      showStatus("Profile updated");
      await loadProfile();
      await loadUsers();
      await loadConversations();
    } catch {
      showStatus("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const beginTwoFactorSetup = async () => {
    try {
      setSavingTwoFactor(true);
      const res = await fetch("/api/profile/2fa/setup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to start 2FA setup");
        return;
      }

      setTwoFactorSetup(data.setup as TwoFactorSetupState);
      setTwoFactorOtp("");
      setEditingProfileField("twoFactor");
    } catch {
      showStatus("Failed to start 2FA setup");
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const enableTwoFactor = async () => {
    if (twoFactorOtp.trim().length !== 6) {
      showStatus("Enter the 6-digit code from your authenticator app");
      return;
    }

    try {
      setSavingTwoFactor(true);
      const res = await fetch("/api/profile/2fa/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otp: twoFactorOtp.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to enable 2FA");
        return;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              twoFactorEnabled: true,
            }
          : current,
      );
      setTwoFactorSetup(null);
      setTwoFactorOtp("");
      setEditingProfileField("");
      showStatus("Two-factor authentication enabled");
      await loadProfile();
    } catch {
      showStatus("Failed to enable 2FA");
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const disableTwoFactor = async () => {
    if (twoFactorOtp.trim().length !== 6) {
      showStatus(
        twoFactorDisableMethod === "email"
          ? "Enter the 6-digit email OTP to disable 2FA"
          : "Enter the current authenticator code to disable 2FA",
      );
      return;
    }

    try {
      setSavingTwoFactor(true);
      const res = await fetch("/api/profile/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otp: twoFactorOtp.trim(),
          method: twoFactorDisableMethod,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to disable 2FA");
        return;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              twoFactorEnabled: false,
            }
          : current,
      );
      setTwoFactorSetup(null);
      setTwoFactorOtp("");
      setEditingProfileField("");
      showStatus("Two-factor authentication disabled");
      await loadProfile();
    } catch {
      showStatus("Failed to disable 2FA");
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const registerPasskey = async () => {
    try {
      setSavingPasskey(true);

      const optionsRes = await fetch("/api/passkeys/register/options", {
        method: "POST",
      });
      const optionsData = await optionsRes.json();

      if (!optionsRes.ok || !optionsData.options) {
        showStatus(optionsData.message || "Failed to start passkey setup");
        return;
      }

      const registrationResponse = await startRegistration(optionsData.options);
      const verifyRes = await fetch("/api/passkeys/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationResponse),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        showStatus(verifyData.message || "Failed to save passkey");
        return;
      }

      showStatus(verifyData.message || "Passkey saved successfully");
      await loadPasskeys();
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Passkey setup was cancelled",
      );
    } finally {
      setSavingPasskey(false);
    }
  };

  const loadPasskeys = useCallback(async () => {
    try {
      setLoadingPasskeys(true);
      const res = await fetch("/api/passkeys", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to load saved passkeys");
        return;
      }

      setPasskeys((data.passkeys || []) as PasskeySummary[]);
    } catch {
      showStatus("Failed to load saved passkeys");
    } finally {
      setLoadingPasskeys(false);
    }
  }, [showStatus]);

  const removePasskey = async (credentialID: string) => {
    try {
      setRemovingPasskeyId(credentialID);
      const res = await fetch("/api/passkeys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credentialID }),
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to remove saved passkey");
        return;
      }

      showStatus(data.message || "Saved passkey removed");
      setPasskeys((current) =>
        current.filter((passkey) => passkey.credentialID !== credentialID),
      );
    } catch {
      showStatus("Failed to remove saved passkey");
    } finally {
      setRemovingPasskeyId("");
    }
  };

  const requestDisableTwoFactorEmailOtp = async () => {
    try {
      setSendingDisableTwoFactorEmailOtp(true);
      const res = await fetch("/api/profile/2fa/disable-email", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to send disable-2FA OTP");
        return;
      }

      setTwoFactorDisableMethod("email");
      setTwoFactorOtp("");
      showStatus(
        data.devOtp ? `${data.message} DEV OTP: ${data.devOtp}` : data.message,
      );
    } catch {
      showStatus("Failed to send disable-2FA OTP");
    } finally {
      setSendingDisableTwoFactorEmailOtp(false);
    }
  };

  const stageGifMessage = (gifUrl: string) => {
    setPendingAttachment({
      name: "GIF",
      type: "image/gif",
      dataUrl: gifUrl,
    });
    setShowComposerMenu(false);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    showStatus("GIF ready");
  };

  const addContact = async () => {
    try {
      if (!addContactName.trim()) {
        showStatus("Enter a contact name");
        return;
      }

      if (!addContactPhone.trim()) {
        showStatus("Enter a phone number to add a contact");
        return;
      }

      setAddingContact(true);

      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: addContactName.trim(),
          phone: addContactPhone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to add contact");
        return;
      }

      setAddContactName("");
      setAddContactPhone("");
      setShowAddContactView(false);
      showStatus(data.message || "Contact saved");
      await loadUsers();
    } catch {
      showStatus("Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  const openAddContactForUser = useCallback((user: UserType | null | undefined) => {
    if (!user) return;

    setAddContactName(getAccountName(user) || user.name || "");
    setAddContactPhone(user.phone || "");
    setShowContactsView(false);
    setShowContactDetails(false);
    setShowAddContactView(true);
  }, [getAccountName]);

  const saveContactName = async () => {
    if (!selectedConversationUser?._id) {
      showStatus("Open a contact first");
      return;
    }

    if (!contactSavedName.trim()) {
      showStatus("Enter a saved name");
      return;
    }

    try {
      setSavingContactName(true);

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactUserId: selectedConversationUser._id,
          name: contactSavedName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to update contact");
        return;
      }

      showStatus("Contact name updated");
      await loadUsers();
      await loadConversations();
      setEditingContactSavedName(false);
    } catch {
      showStatus("Failed to update contact");
    } finally {
      setSavingContactName(false);
    }
  };

  const deleteSavedContact = async () => {
    if (!selectedConversationUser?._id) {
      showStatus("Open a contact first");
      return;
    }

    try {
      const res = await fetch(
        `/api/users?contactUserId=${selectedConversationUser._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to delete contact");
        return;
      }

      setShowContactDetails(false);
      setEditingContactSavedName(false);
      await loadUsers();
      await loadConversations();
      showStatus("Contact removed");
    } catch {
      showStatus("Failed to delete contact");
    }
  };

  const fetchGifs = useCallback(
    async (offset: number) => {
      if (!giphyFetch) {
        return EMPTY_GIFS_RESULT;
      }

      if (deferredGifSearchTerm) {
        return giphyFetch.search(deferredGifSearchTerm, {
          offset,
          limit: 12,
        });
      }

      return giphyFetch.trending({
        offset,
        limit: 12,
      });
    },
    [deferredGifSearchTerm, giphyFetch],
  );

  const postMessage = useCallback(
    async ({
      conversationId,
      text,
      image,
      replyTo,
    }: {
      conversationId: string;
      text?: string;
      image?: string;
      replyTo?: string;
    }) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          text,
          image,
          replyTo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      return data.data as MessageType | undefined;
    },
    [],
  );

  const sendPayload = async ({
    text,
    image,
  }: {
    text?: string;
    image?: string;
  }) => {
    try {
      if (!selectedConversationId || (!text && !image)) return;

      setSending(true);

      if (editingMessageId) {
        const res = await fetch("/api/messages", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messageId: editingMessageId,
            action: "edit",
            text,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          showStatus(data.message || "Failed to edit message");
          return;
        }

        const updatedMessage = data.data as MessageType | undefined;

        if (updatedMessage) {
          setMessages((prev) =>
            prev.map((message) =>
              message._id === updatedMessage._id ? updatedMessage : message,
            ),
          );
        }

        setMessageText("");
        setEditingMessageId("");
        setEditingImagePreview("");
        setReplyingToMessage(null);
        showStatus("Message updated");
        await loadConversations();
        return;
      }

      const createdMessage = await postMessage({
        conversationId: selectedConversationId,
        text,
        image,
        replyTo: replyingToMessage?._id,
      });

      setMessageText("");
      setTypingUserName("");
      setShowComposerMenu(false);
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      setGifSearchTerm("");
      setPendingAttachment(null);
      setReplyingToMessage(null);
      setEditingImagePreview("");
      setMessageMenuId("");

      socket.emit("typing-stop", {
        receiverId: selectedUserIdRef.current,
        conversationId: selectedConversationIdRef.current,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (createdMessage) {
        setMessages((prev) => {
          const alreadyExists = prev.some(
            (msg) => msg._id === createdMessage._id,
          );
          return alreadyExists ? prev : [...prev, createdMessage];
        });

        socket.emit("send-message", {
          _id: createdMessage._id,
          conversationId: selectedConversationId,
          text: createdMessage.text,
          image: createdMessage.image,
          createdAt: createdMessage.createdAt,
          deliveredTo: createdMessage.deliveredTo || [],
          seenBy: createdMessage.seenBy || [],
          sender: {
            _id: currentUserId,
            name: currentUserName,
            email: currentUserEmail,
          },
          receiverId: selectedUserIdRef.current,
        });
      }

      await loadConversations();
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = useCallback(
    (conversation: ConversationType) => {
      const validParticipants = (conversation.participants || []).filter(
        (participant): participant is UserType =>
          Boolean(participant?._id),
      );

      const otherParticipant =
        validParticipants.find((participant) => participant._id !== currentUserId) ||
        validParticipants[0] ||
        null;

      return withSavedContactName(otherParticipant);
    },
    [currentUserId, withSavedContactName],
  );

  const getMessageStatus = (message: MessageType) => {
    if (message.sender?._id !== currentUserId) return "";

    const seenCount =
      message.seenBy?.filter((id) => id !== currentUserId).length || 0;
    const deliveredCount =
      message.deliveredTo?.filter((id) => id !== currentUserId).length || 0;

    if (seenCount > 0) return "Seen";
    if (deliveredCount > 0) return "Delivered";
    return "Sent";
  };

  const getMessagePreview = useCallback((message: MessageType | MessageType["replyTo"]) => {
    if (!message) return "Message";
    if (message.deletedForEveryone) return "This message was deleted";
    if (message.text?.trim()) return message.text.trim();
    if (message.image) return "Photo/GIF";
    return "Message";
  }, []);

  const renderAvatar = (
    user: Pick<UserType, "name" | "avatar"> | null | undefined,
    sizeClass = "h-10 w-10",
  ) => {
    if (user?.avatar) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt={user.name || "Avatar"}
          className={`${sizeClass} rounded-full object-cover`}
        />
      );
    }

    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300`}
      >
        {(user?.name || "U").charAt(0).toUpperCase()}
      </div>
    );
  };

  const updateSingleMessage = useCallback((updatedMessage: MessageType) => {
    setMessages((prev) =>
      prev.map((message) =>
        message._id === updatedMessage._id ? updatedMessage : message,
      ),
    );
  }, []);

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId],
    );
    setForwardingSelectedMessages(false);
    setMessageMenuId("");
  };

  const clearSelectedMessages = () => {
    setSelectedMessageIds([]);
    setForwardingSelectedMessages(false);
  };

  const copyMessage = async (message: MessageType) => {
    const value = message.text?.trim() || message.image || "";

    if (!value) {
      showStatus("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showStatus("Message copied");
    } catch {
      showStatus("Failed to copy message");
    }
    setMessageMenuId("");
  };

  const toggleStarMessage = async (message: MessageType) => {
    try {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: message._id,
          action: "toggle-star",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to update message");
        return;
      }

      updateSingleMessage(data.data as MessageType);
      setMessageMenuId("");
      showStatus(message.starred ? "Star removed" : "Message starred");
    } catch {
      showStatus("Failed to update message");
    }
  };

  const togglePinMessage = async (message: MessageType) => {
    try {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: message._id,
          action: "pin",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to update pinned message");
        return;
      }

      setMessageMenuId("");
      await loadConversations();
      showStatus(
        selectedConversation?.pinnedMessage?._id === message._id
          ? "Pinned message removed"
          : "Pinned message updated",
      );
    } catch {
      showStatus("Failed to update pinned message");
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const res = await fetch(
        `/api/conversations?conversationId=${conversationId}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to delete chat");
        return;
      }

      setConversationMenuId("");

      if (selectedConversationId === conversationId) {
        closeChat();
      }

      await loadConversations();
      showStatus("Chat deleted for you");
    } catch {
      showStatus("Failed to delete chat");
    }
  };

  const startReplyingToMessage = (message: MessageType) => {
    setReplyingToMessage(message);
    setEditingMessageId("");
    setForwardingMessage(null);
    setMessageMenuId("");
  };

  const startEditingMessage = (message: MessageType) => {
    if (message.sender?._id !== currentUserId || message.deletedForEveryone) {
      showStatus("Only your active messages can be edited");
      return;
    }

    setEditingMessageId(message._id);
    setMessageText(message.text || "");
    setEditingImagePreview(message.image || "");
    setReplyingToMessage(null);
    setForwardingMessage(null);
    setMessageMenuId("");
  };

  const deleteMessage = async (
    message: MessageType,
    deleteFor: "me" | "everyone" = "everyone",
  ) => {
    if (deleteFor === "everyone" && message.sender?._id !== currentUserId) {
      showStatus("Only your messages can be deleted for everyone");
      return;
    }

    try {
      const res = await fetch(
        `/api/messages?messageId=${message._id}&deleteFor=${deleteFor}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        showStatus(data.message || "Failed to delete message");
        return;
      }

      if (deleteFor === "me") {
        setMessages((prev) => prev.filter((item) => item._id !== message._id));
      } else {
        const updatedMessage = data.data as MessageType;
        updateSingleMessage(updatedMessage);

        if (selectedConversationIdRef.current && selectedUserIdRef.current) {
          socket.emit("message-updated", {
            receiverId: selectedUserIdRef.current,
            senderId: currentUserId,
            conversationId: selectedConversationIdRef.current,
            message: updatedMessage,
          });
        }
      }
      setMessageMenuId("");
      setDeleteOptionsMessageId("");
      await loadConversations();
      showStatus(deleteFor === "me" ? "Message deleted for you" : "Message deleted");
    } catch {
      showStatus("Failed to delete message");
    }
  };

  const startForwardingMessage = (message: MessageType) => {
    setForwardingMessage(message);
    setForwardingSelectedMessages(false);
    setReplyingToMessage(null);
    setEditingMessageId("");
    setEditingImagePreview("");
    setMessageMenuId("");
    showStatus("Select a contact or conversation to forward this message");
  };

  const startForwardingSelectedMessages = () => {
    if (selectedMessages.length === 0) {
      showStatus("Select at least one message to forward");
      return;
    }

    setForwardingMessage(null);
    setReplyingToMessage(null);
    setEditingMessageId("");
    setEditingImagePreview("");
    setForwardingSelectedMessages(true);
    showStatus(
      selectedMessages.length === 1
        ? "Select a contact or conversation to forward this message"
        : `Select a contact or conversation to forward ${selectedMessages.length} messages`,
    );
  };

  const copySelectedMessages = async () => {
    const value = selectedMessages.map((message) => getMessagePreview(message)).join("\n");

    if (!value.trim()) {
      showStatus("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showStatus(
        selectedMessages.length === 1
          ? "Message copied"
          : `${selectedMessages.length} messages copied`,
      );
    } catch {
      showStatus("Failed to copy messages");
    }
  };

  const starSelectedMessages = async () => {
    const messagesToToggle = allSelectedMessagesStarred
      ? selectedMessages.filter((message) => message.starred)
      : selectedMessages.filter((message) => !message.starred);

    if (messagesToToggle.length === 0) {
      showStatus(
        allSelectedMessagesStarred
          ? "Selected messages are already unstarred"
          : "Selected messages are already starred",
      );
      return;
    }

    try {
      const results = await Promise.all(
        messagesToToggle.map(async (message) => {
          const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageId: message._id,
              action: "toggle-star",
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || "Failed to star messages");
          }

          return data.data as MessageType;
        }),
      );

      results.forEach((message) => updateSingleMessage(message));
      clearSelectedMessages();
      showStatus(
        allSelectedMessagesStarred
          ? results.length === 1
            ? "Message unstarred"
            : `${results.length} messages unstarred`
          : results.length === 1
            ? "Message starred"
            : `${results.length} messages starred`,
      );
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to star messages",
      );
    }
  };

  const deleteSelectedMessages = async () => {
    const ownMessages = selectedMessages.filter(
      (message) => message.sender?._id === currentUserId,
    );

    if (ownMessages.length === 0) {
      showStatus("Only your messages can be deleted");
      return;
    }

    try {
      const results = await Promise.all(
        ownMessages.map(async (message) => {
          const res = await fetch(`/api/messages?messageId=${message._id}`, {
            method: "DELETE",
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || "Failed to delete messages");
          }

          return data.data as MessageType;
        }),
      );

      results.forEach((message) => updateSingleMessage(message));
      clearSelectedMessages();
      await loadConversations();
      showStatus(
        results.length === 1 ? "Message deleted" : `${results.length} messages deleted`,
      );
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to delete messages",
      );
    }
  };

  const forwardMessageToConversation = useCallback(
    async (conversationId: string, receiverId: string, message: MessageType) => {
      try {
        setSending(true);

        const forwardedMessage = await postMessage({
          conversationId,
          text: message.text?.trim() || undefined,
          image: message.image,
        });

        setSelectedConversationId(conversationId);
        setSelectedUserId(receiverId);
        setForwardingMessage(null);

        if (forwardedMessage) {
          await loadMessages(conversationId);
        } else {
          await loadConversations();
        }

        showStatus("Message forwarded");
      } catch (error) {
        showStatus(
          error instanceof Error ? error.message : "Failed to forward message",
        );
      } finally {
        setSending(false);
      }
    },
    [loadConversations, loadMessages, postMessage, showStatus],
  );

  const forwardSelectedMessagesToConversation = useCallback(
    async (
      conversationId: string,
      receiverId: string,
      messagesToForward: MessageType[],
    ) => {
      try {
        setSending(true);

        for (const message of messagesToForward) {
          await postMessage({
            conversationId,
            text: message.text?.trim() || undefined,
            image: message.image,
          });
        }

        setSelectedConversationId(conversationId);
        setSelectedUserId(receiverId);
        clearSelectedMessages();
        await loadMessages(conversationId);
        showStatus(
          messagesToForward.length === 1
            ? "Message forwarded"
            : `${messagesToForward.length} messages forwarded`,
        );
      } catch (error) {
        showStatus(
          error instanceof Error ? error.message : "Failed to forward messages",
        );
      } finally {
        setSending(false);
      }
    },
    [loadMessages, postMessage, showStatus],
  );

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c._id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  const selectedMessages = useMemo(() => {
    return messages.filter((message) => selectedMessageIds.includes(message._id));
  }, [messages, selectedMessageIds]);
  const allSelectedMessagesStarred = useMemo(
    () =>
      selectedMessages.length > 0 &&
      selectedMessages.every((message) => Boolean(message.starred)),
    [selectedMessages],
  );

  const selectionMode = selectedMessageIds.length > 0;

  const selectedConversationUser = useMemo(() => {
    if (!selectedConversation) return null;
    return getOtherParticipant(selectedConversation);
  }, [selectedConversation, getOtherParticipant]);

  const selectedConversationUserOnline = useMemo(() => {
    if (!selectedConversationUser) return false;
    return onlineUserIds.includes(selectedConversationUser._id);
  }, [selectedConversationUser, onlineUserIds]);

  const selectedConversationIsSaved = useMemo(
    () => isSavedContact(selectedConversationUser),
    [isSavedContact, selectedConversationUser],
  );

  useEffect(() => {
    setContactSavedName(selectedConversationUser?.name || "");
    setEditingContactSavedName(false);
  }, [selectedConversationUser]);

  useEffect(() => {
    if (!showProfileEditor) {
      setEditingProfileField("");
      setTwoFactorSetup(null);
      setTwoFactorOtp("");
      setTwoFactorDisableMethod("authenticator");
      setSendingDisableTwoFactorEmailOtp(false);
    }
  }, [showProfileEditor]);

  useEffect(() => {
    void (async () => {
      setPasskeySupported(browserSupportsWebAuthn());
    })();
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadPasskeys();
    }
  }, [loadPasskeys, sessionStatus]);

  const openConversation = async (
    conversationId: string,
    userId: string,
    messageToForward?: MessageType | null,
  ) => {
    if (forwardingSelectedMessages && selectedMessages.length > 0) {
      await forwardSelectedMessagesToConversation(
        conversationId,
        userId,
        selectedMessages,
      );
      return;
    }

    if (messageToForward) {
      await forwardMessageToConversation(conversationId, userId, messageToForward);
      return;
    }

    setSelectedUserId(userId);
    await loadMessages(conversationId);
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      (async () => {
        await Promise.all([loadProfile(), loadUsers(), loadConversations()]);
        showStatus("Chats loaded");
      })();
    }
  }, [loadConversations, loadProfile, loadUsers, sessionStatus, showStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !currentUserId) return;

    socket.connect();

    const handleConnect = () => {
      console.log("socket connected:", socket.id);
      socket.emit("join", currentUserId);
    };

    const handleReceiveMessage = (incomingMessage: ReceiveMessagePayload) => {
      console.log("receive-message:", incomingMessage);

      if (
        incomingMessage.conversationId !== selectedConversationIdRef.current
      ) {
        loadConversations();
        return;
      }

      const normalizedMessage: MessageType = {
        _id:
          incomingMessage._id ||
          `${incomingMessage.conversationId}-${Date.now()}`,
        text: incomingMessage.text || "",
        image: incomingMessage.image || "",
        createdAt: incomingMessage.createdAt || new Date().toISOString(),
        deliveredTo: incomingMessage.deliveredTo || [],
        seenBy: incomingMessage.seenBy || [],
        sender: {
          _id: incomingMessage.sender?._id,
          name: incomingMessage.sender?.name || "Unknown",
          email: incomingMessage.sender?.email || "",
          avatar: incomingMessage.sender?.avatar || "",
        },
      };

      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === normalizedMessage._id);
        if (exists) return prev;
        return [...prev, normalizedMessage];
      });

      setTypingUserName("");
      loadConversations();
      showStatus("New message received");

      if (incomingMessage.sender?._id) {
        socket.emit("message-delivered", {
          senderId: incomingMessage.sender._id,
          messageId: normalizedMessage._id,
          conversationId: incomingMessage.conversationId,
        });

        if (
          incomingMessage.conversationId === selectedConversationIdRef.current
        ) {
          socket.emit("message-seen", {
            senderId: incomingMessage.sender._id,
            messageId: normalizedMessage._id,
            conversationId: incomingMessage.conversationId,
          });
        }
      }
    };

    const handleOnlineUsers = (userIds: string[]) => {
      setOnlineUserIds(userIds);
    };

    const handleTypingStart = ({
      senderId,
      senderName,
      conversationId,
    }: {
      senderId?: string;
      senderName?: string;
      conversationId?: string;
    }) => {
      if (conversationId !== selectedConversationIdRef.current) return;
      setTypingUserName(
        getDisplayName({
          _id: senderId,
          name: senderName || "Someone",
        }),
      );
    };

    const handleTypingStop = ({
      conversationId,
    }: {
      conversationId?: string;
    }) => {
      if (conversationId !== selectedConversationIdRef.current) return;
      setTypingUserName("");
    };

    const handleMessageDelivered = ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      if (conversationId !== selectedConversationIdRef.current) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                deliveredTo: Array.from(
                  new Set([
                    ...(msg.deliveredTo || []),
                    selectedUserIdRef.current,
                  ]),
                ),
              }
            : msg,
        ),
      );
    };

    const handleMessageSeen = ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      if (conversationId !== selectedConversationIdRef.current) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                seenBy: Array.from(
                  new Set([...(msg.seenBy || []), selectedUserIdRef.current]),
                ),
              }
            : msg,
        ),
      );
      loadConversations();
    };

    const handleMessageUpdated = ({
      conversationId,
      message,
    }: {
      conversationId: string;
      message: MessageType;
    }) => {
      if (conversationId !== selectedConversationIdRef.current) {
        loadConversations();
        return;
      }

      updateSingleMessage(message);
      loadConversations();
    };

    socket.on("connect", handleConnect);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("online-users", handleOnlineUsers);
    socket.on("typing-start", handleTypingStart);
    socket.on("typing-stop", handleTypingStop);
    socket.on("message-delivered", handleMessageDelivered);
    socket.on("message-seen", handleMessageSeen);
    socket.on("message-updated", handleMessageUpdated);

    if (socket.connected) {
      socket.emit("join", currentUserId);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("online-users", handleOnlineUsers);
      socket.off("typing-start", handleTypingStart);
      socket.off("typing-stop", handleTypingStop);
      socket.off("message-delivered", handleMessageDelivered);
      socket.off("message-seen", handleMessageSeen);
      socket.off("message-updated", handleMessageUpdated);
      socket.disconnect();
    };
  }, [
    currentUserId,
    getDisplayName,
    loadConversations,
    sessionStatus,
    showStatus,
    updateSingleMessage,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserName]);

  const handleTyping = (value: string) => {
    setMessageText(value);

    if (!selectedUserIdRef.current || !selectedConversationIdRef.current) {
      return;
    }

    socket.emit("typing-start", {
      receiverId: selectedUserIdRef.current,
      senderName: currentUserName,
      conversationId: selectedConversationIdRef.current,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing-stop", {
        receiverId: selectedUserIdRef.current,
        conversationId: selectedConversationIdRef.current,
      });
    }, 1000);
  };

  const addEmoji = (emoji: string) => {
    setMessageText((prev) => `${prev}${emoji}`);
    setShowComposerMenu(false);
    setShowGifPicker(false);
  };

  if (sessionStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-400">Loading session...</p>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden bg-zinc-950 text-white">
      <div className="grid h-dvh w-full grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
        <aside
            className={`overflow-y-auto border-r border-zinc-800 bg-zinc-900/70 p-4 ${
              selectedConversationId ||
              showProfileEditor ||
              showSecurityView ||
              showContactsView ||
              showAddContactView ||
              showContactDetails
              ? "hidden md:block"
              : "block"
          }`}
        >
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex min-w-0 items-center gap-3" ref={accountMenuRef}>
                  <button
                   onClick={() => setShowAccountMenu((current) => !current)}
                   className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900 transition hover:border-emerald-500"
                  >
                  {profileAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileAvatar}
                      alt="Profile avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-400">
                      {(profile?.name || session?.user?.name || "Y")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </button>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold">Chats</h1>
                    <p className="mt-1 min-h-5 text-sm leading-5 text-zinc-400">
                      {status || " "}
                    </p>
                  </div>
                  {showAccountMenu && (
                    <div className="absolute left-0 top-16 z-30 w-52 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40">
                      <button
                        type="button"
                        onClick={openProfileView}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm text-zinc-100 transition hover:bg-zinc-900 hover:text-white"
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={openSecurityView}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm text-zinc-100 transition hover:bg-zinc-900 hover:text-white"
                      >
                        Security
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountMenu(false);
                          void signOut("/login");
                        }}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm text-red-200 transition hover:bg-red-500/10 hover:text-red-100"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowProfileEditor(false);
                    setShowAddContactView(false);
                    setShowContactDetails(false);
                    setShowContactsView(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition hover:border-emerald-500 hover:text-white"
                  aria-label="Saved contacts"
                  title="Saved contacts"
                >
                  <Users size={18} className="text-emerald-400" />
                </button>
                <button
                  onClick={() => {
                    setShowContactsView(false);
                    setAddContactName("");
                    setAddContactPhone("");
                    setShowAddContactView(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/80 text-zinc-200 transition hover:border-emerald-500 hover:text-white"
                  aria-label="Add contact"
                  title="Add contact"
                  >
                    <UserPlus size={18} className="text-emerald-400" />
                  </button>
                </div>
              </div>
            </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversations</h2>
              <button
                onClick={loadConversations}
                disabled={loadingConversations}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-zinc-500">No conversations yet</p>
              ) : (
                conversations.map((conversation) => {
                  const otherUser = getOtherParticipant(conversation);
                  const isOnline = otherUser
                    ? onlineUserIds.includes(otherUser._id)
                    : false;

                  return (
                    <div
                      key={conversation._id}
                      data-conversation-menu-root
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedConversationId === conversation._id
                          ? "border-emerald-500 bg-zinc-800"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!otherUser?._id) return;
                            await openConversation(
                              conversation._id,
                              otherUser._id,
                              forwardingMessage,
                            );
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          {renderAvatar(otherUser)}
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {getPhoneDisplayName(otherUser)}
                            </p>
                            <p className="mt-1 truncate text-sm text-zinc-400">
                              {conversation.lastMessage?.text || "No messages yet"}
                            </p>
                          </div>
                        </button>

                        <div className="relative flex items-center gap-2">
                          {/* 🔴 UNREAD BADGE */}
                          {conversation.unreadCount &&
                            conversation.unreadCount > 0 && (
                              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-black">
                                {conversation.unreadCount}
                              </span>
                            )}

                          {/* 🟢 ONLINE DOT */}
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isOnline ? "bg-emerald-500" : "bg-zinc-600"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setConversationMenuId((prev) =>
                                prev === conversation._id ? "" : conversation._id,
                              );
                            }}
                            className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                          >
                            <ChevronDown size={16} />
                          </button>
                          {conversationMenuId === conversation._id && (
                            <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void deleteConversation(conversation._id);
                                }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-zinc-900"
                              >
                                <Trash2 size={16} />
                                <span>Delete chat</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <section
            className={`flex h-dvh min-h-0 flex-col overflow-hidden ${
              selectedConversationId ||
              showProfileEditor ||
              showSecurityView ||
              showContactsView ||
              showAddContactView ||
              showContactDetails
              ? "flex"
              : "hidden md:flex"
          }`}
        >
          <div className="border-b border-zinc-800 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => {
                    if (
                      selectedConversationUser &&
                      !showProfileEditor &&
                      !showSecurityView &&
                      !showContactsView &&
                      !showAddContactView
                  ) {
                    setShowContactDetails(true);
                  }
                }}
                className={`flex min-w-0 flex-1 items-center gap-3 ${
                    selectedConversationUser &&
                    !showProfileEditor &&
                    !showSecurityView &&
                    !showContactsView &&
                    !showAddContactView
                    ? "cursor-pointer"
                    : ""
                }`}
              >
                  {(selectedConversationId ||
                    showProfileEditor ||
                    showSecurityView ||
                    showContactsView ||
                    showAddContactView ||
                  showContactDetails) && (
                  <button
                    onClick={(event) => {
                        event.stopPropagation();
                        if (showProfileEditor) {
                          setShowProfileEditor(false);
                        } else if (showSecurityView) {
                          setShowSecurityView(false);
                        } else if (showContactsView) {
                          setShowContactsView(false);
                      } else if (showAddContactView) {
                        setShowAddContactView(false);
                      } else if (showContactDetails) {
                        setShowContactDetails(false);
                      } else {
                        closeChat();
                      }
                    }}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100 md:hidden"
                  >
                    Back
                  </button>
                )}
                  <div className="relative shrink-0">
                   {showProfileEditor || showSecurityView ? (
                      renderAvatar(
                        {
                          name: profile?.name || session?.user?.name || "You",
                        avatar: profileAvatar || profile?.avatar,
                      },
                      "h-11 w-11",
                    )
                  ) : showContactsView ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <Users size={18} />
                    </div>
                  ) : showAddContactView ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <UserPlus size={18} />
                    </div>
                  ) : showContactDetails && selectedConversationUser ? (
                    renderAvatar(selectedConversationUser, "h-11 w-11")
                  ) : selectedConversationUser ? (
                    renderAvatar(selectedConversationUser, "h-11 w-11")
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      M
                    </div>
                  )}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-950 ${
                       showProfileEditor || showSecurityView
                          ? "bg-emerald-500"
                          : showContactsView
                        ? "bg-emerald-500"
                        : showAddContactView
                        ? "bg-emerald-500"
                        : selectedConversationUserOnline
                        ? "bg-emerald-500"
                        : "bg-zinc-600"
                    }`}
                  />
                </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold">
                     {showProfileEditor
                        ? "Profile"
                        : showSecurityView
                        ? "Security"
                        : showContactsView
                      ? "Contacts"
                      : showAddContactView
                      ? "Add Contact"
                      : showContactDetails
                      ? selectedConversationUser
                        ? getPhoneDisplayName(selectedConversationUser)
                        : "Contact"
                      : selectedConversationUser
                      ? getPhoneDisplayName(selectedConversationUser)
                      : "Messages"}
                  </h2>
                    <p className="text-sm text-zinc-400">
                     {showProfileEditor
                        ? "Update your photo, bio and status"
                        : showSecurityView
                        ? "Manage sign-in, passkeys and two-factor security"
                        : showContactsView
                      ? "Every saved contact in your phonebook"
                      : showAddContactView
                      ? "Save a registered user by phone number and name"
                      : showContactDetails
                      ? selectedConversationUser?.phone ||
                        selectedConversationUser?.email ||
                        "Contact details"
                      : selectedConversationUser
                      ? selectedConversationIsSaved
                        ? selectedConversationUser.phone ||
                          (selectedConversationUserOnline ? "Online" : "Offline")
                        : selectedConversationUser.phone ||
                        (selectedConversationUserOnline ? "Online" : "Offline")
                      : selectedConversationId
                        ? `Conversation ID: ${selectedConversationId}`
                        : "Select a user or conversation"}
                  </p>
                </div>
              </div>
                {(selectedConversationId ||
                  showProfileEditor ||
                  showSecurityView ||
                  showContactsView ||
                  showAddContactView ||
                showContactDetails) && (
                <button
                    onClick={() => {
                      if (showProfileEditor) {
                        setShowProfileEditor(false);
                      } else if (showSecurityView) {
                        setShowSecurityView(false);
                      } else if (showContactsView) {
                        setShowContactsView(false);
                    } else if (showAddContactView) {
                      setShowAddContactView(false);
                    } else if (showContactDetails) {
                      setShowContactDetails(false);
                    } else {
                      closeChat();
                    }
                  }}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                  >
                    {showProfileEditor
                      ? "Close profile"
                      : showSecurityView
                      ? "Close security"
                      : showContactsView
                    ? "Close contacts"
                    : showAddContactView
                    ? "Close add contact"
                    : showContactDetails
                    ? "Close details"
                    : "Close chat"}
                </button>
              )}
            </div>
          </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
             {showProfileEditor ? (
                <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="h-28 w-28 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                    {profileAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profileAvatar}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-400">
                        {(profile?.name || session?.user?.name || "Y")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-semibold text-white">
                      {profile?.name || session?.user?.name || "Your profile"}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {profile?.email || session?.user?.email || ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {profilePhone || "No phone number"}
                    </p>
                    {editingProfileField === "photo" ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <label className="inline-flex cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800">
                          Choose photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={saveProfile}
                          disabled={savingProfile}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                        >
                          {savingProfile ? "Saving..." : "Save photo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileAvatar(profile?.avatar || "");
                            setEditingProfileField("");
                          }}
                          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProfileField("photo")}
                        className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:border-emerald-500 hover:bg-zinc-800 hover:text-white"
                      >
                        Edit photo
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Phone number
                        </p>
                        <p className="mt-2 text-sm text-zinc-200">
                          {profilePhone || "No phone number"}
                        </p>
                      </div>
                      {editingProfileField !== "phone" && (
                        <button
                          type="button"
                          onClick={() => setEditingProfileField("phone")}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingProfileField === "phone" && (
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          id="profile-phone"
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          maxLength={20}
                          placeholder="Enter your phone number"
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={saveProfile}
                            disabled={savingProfile}
                            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                          >
                            {savingProfile ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfilePhone(profile?.phone || "");
                              setEditingProfileField("");
                            }}
                            className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Status
                        </p>
                        <p className="mt-2 text-sm text-zinc-200">
                          {profileStatus || "Available"}
                        </p>
                      </div>
                      {editingProfileField !== "status" && (
                        <button
                          type="button"
                          onClick={() => setEditingProfileField("status")}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingProfileField === "status" && (
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          id="profile-status"
                          type="text"
                          value={profileStatus}
                          onChange={(e) => setProfileStatus(e.target.value)}
                          maxLength={80}
                          placeholder="Available"
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={saveProfile}
                            disabled={savingProfile}
                            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                          >
                            {savingProfile ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileStatus(profile?.status || "Available");
                              setEditingProfileField("");
                            }}
                            className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Bio
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                          {profileBio || "No bio added yet."}
                        </p>
                      </div>
                      {editingProfileField !== "bio" && (
                        <button
                          type="button"
                          onClick={() => setEditingProfileField("bio")}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                      {editingProfileField === "bio" && (
                        <div className="mt-3 space-y-3">
                        <textarea
                          id="profile-bio"
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          maxLength={240}
                          rows={4}
                          placeholder="Tell people a little about yourself"
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileBio(profile?.bio || "");
                              setEditingProfileField("");
                            }}
                            className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveProfile}
                            disabled={savingProfile}
                            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                          >
                            {savingProfile ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                      )}
                    </div>

                  </div>
                </div>
              ) : showSecurityView ? (
                <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Change password
                          </p>
                          <p className="mt-2 text-sm text-zinc-200">
                            Reset your password using your existing email OTP flow.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = "/forgot-password";
                          }}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white"
                        >
                          Change password
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Passkey / device sign-in
                          </p>
                          <p className="mt-2 text-sm text-zinc-200">
                            Save credentials on this device to sign in with Windows Hello, Android fingerprint, iPhone Face ID, or a compatible passkey provider.
                          </p>
                          <p className="mt-2 text-sm text-zinc-400">
                            {loadingPasskeys
                              ? "Checking saved devices..."
                              : passkeys.length > 0
                                ? `${passkeys.length} saved credential${passkeys.length === 1 ? "" : "s"} on this account.`
                                : "No saved passkeys on this account yet."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={registerPasskey}
                          disabled={!passkeySupported || savingPasskey}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
                        >
                          {savingPasskey
                            ? "Saving..."
                            : passkeySupported
                              ? "Save credentials"
                              : "Not supported"}
                        </button>
                      </div>
                      {!passkeySupported && (
                        <p className="mt-3 text-sm text-zinc-500">
                          Passkeys need a supported browser and device security provider.
                        </p>
                      )}
                      {passkeys.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {passkeys.map((passkey) => (
                            <div
                              key={passkey.credentialID}
                              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-100">
                                  {passkey.label}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {passkey.deviceType || "unknown"}{passkey.backedUp ? " • backed up" : ""}
                                  {passkey.transports?.length
                                    ? ` • ${passkey.transports.join(", ")}`
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removePasskey(passkey.credentialID)}
                                disabled={removingPasskeyId === passkey.credentialID}
                                className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
                              >
                                {removingPasskeyId === passkey.credentialID
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Authenticator app 2FA
                          </p>
                          <p className="mt-2 text-sm text-zinc-200">
                            {profile?.twoFactorEnabled
                              ? "Enabled. You will need a time-based code from Google Authenticator, Authy, or a similar app when signing in."
                              : "Disabled. Add an authenticator app for an extra sign-in step."}
                          </p>
                        </div>
                        {editingProfileField !== "twoFactor" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (profile?.twoFactorEnabled) {
                                setTwoFactorSetup(null);
                                setTwoFactorOtp("");
                                setEditingProfileField("twoFactor");
                              } else {
                                void beginTwoFactorSetup();
                              }
                            }}
                            disabled={savingTwoFactor}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:opacity-60"
                          >
                            {savingTwoFactor
                              ? "Loading..."
                              : profile?.twoFactorEnabled
                                ? "Manage"
                                : "Set up"}
                          </button>
                        )}
                      </div>
                      {editingProfileField === "twoFactor" && (
                        <div className="mt-4 space-y-4">
                          {profile?.twoFactorEnabled ? (
                            <>
                              <p className="text-sm text-zinc-400">
                                {twoFactorDisableMethod === "email"
                                  ? "Enter the 6-digit OTP sent to your email to disable 2FA."
                                  : "Enter the current 6-digit code from your authenticator app to disable 2FA."}
                              </p>
                              <input
                                type="text"
                                value={twoFactorOtp}
                                onChange={(e) =>
                                  setTwoFactorOtp(
                                    e.target.value.replace(/\D/g, "").slice(0, 6),
                                  )
                                }
                                inputMode="numeric"
                                placeholder={
                                  twoFactorDisableMethod === "email"
                                    ? "Enter 6-digit email OTP"
                                    : "Current 6-digit code"
                                }
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                              />
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={requestDisableTwoFactorEmailOtp}
                                  disabled={
                                    sendingDisableTwoFactorEmailOtp ||
                                    twoFactorDisableMethod === "email"
                                  }
                                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
                                >
                                  {sendingDisableTwoFactorEmailOtp
                                    ? "Sending email OTP..."
                                    : twoFactorDisableMethod === "email"
                                    ? "Email OTP active"
                                    : "Use email OTP instead"}
                                </button>
                                {twoFactorDisableMethod === "email" && (
                                  <button
                                    type="button"
                                    onClick={requestDisableTwoFactorEmailOtp}
                                    disabled={sendingDisableTwoFactorEmailOtp}
                                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
                                  >
                                    {sendingDisableTwoFactorEmailOtp
                                      ? "Resending..."
                                      : "Resend email OTP"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={disableTwoFactor}
                                  disabled={savingTwoFactor || twoFactorOtp.trim().length !== 6}
                                  className="rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
                                >
                                  {savingTwoFactor ? "Disabling..." : "Disable 2FA"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTwoFactorOtp("");
                                    setTwoFactorDisableMethod("authenticator");
                                    setEditingProfileField("");
                                  }}
                                  className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : twoFactorSetup ? (
                            <>
                              <p className="text-sm text-zinc-400">
                                Scan this QR code with Google Authenticator, Authy, or another TOTP app, then enter the 6-digit code to confirm.
                              </p>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-white p-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={twoFactorSetup.qrCodeDataUrl}
                                    alt="2FA QR code"
                                    className="h-44 w-44 object-contain"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Manual key
                                  </p>
                                  <p className="mt-2 break-all rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 font-mono text-sm text-zinc-200">
                                    {twoFactorSetup.manualKey}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={twoFactorOtp}
                                onChange={(e) =>
                                  setTwoFactorOtp(
                                    e.target.value.replace(/\D/g, "").slice(0, 6),
                                  )
                                }
                                inputMode="numeric"
                                placeholder="Enter 6-digit code"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                              />
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={enableTwoFactor}
                                  disabled={savingTwoFactor || twoFactorOtp.trim().length !== 6}
                                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                                >
                                  {savingTwoFactor ? "Verifying..." : "Enable 2FA"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTwoFactorSetup(null);
                                    setTwoFactorOtp("");
                                    setEditingProfileField("");
                                  }}
                                  className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-zinc-400">
                              Loading 2FA setup...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : showContactsView ? (
              <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">
                      Saved Contacts
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      Tap a contact to open the conversation.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={loadUsers}
                      disabled={loadingUsers}
                      className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {loadingUsers ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactsView(false);
                        setAddContactName("");
                        setAddContactPhone("");
                        setShowAddContactView(true);
                      }}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                      Add contact
                    </button>
                  </div>
                </div>

                {users.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                    No saved contacts yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => {
                      const isOnline = onlineUserIds.includes(user._id);

                      return (
                        <button
                          key={user._id}
                          type="button"
                          onClick={async () => {
                            if (forwardingMessage) {
                              const conversationId = await createConversation(
                                user._id,
                                true,
                              );

                              if (conversationId) {
                                await forwardMessageToConversation(
                                  conversationId,
                                  user._id,
                                  forwardingMessage,
                                );
                              }

                              return;
                            }

                            if (
                              forwardingSelectedMessages &&
                              selectedMessages.length > 0
                            ) {
                              const conversationId = await createConversation(
                                user._id,
                                true,
                              );

                              if (conversationId) {
                                await forwardSelectedMessagesToConversation(
                                  conversationId,
                                  user._id,
                                  selectedMessages,
                                );
                              }

                              return;
                            }

                            await createConversation(user._id);
                          }}
                          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-left transition hover:border-emerald-500"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-4">
                              {renderAvatar(user, "h-14 w-14")}
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-white">
                                  {user.savedName || user.name}
                                </p>
                                <p className="mt-1 truncate text-sm text-zinc-400">
                                  {user.status || "Available"}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                isOnline ? "bg-emerald-500" : "bg-zinc-600"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : showAddContactView ? (
              <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <h3 className="text-2xl font-semibold text-white">
                  Save New Contact
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Save a registered phone number with the name you want to see in
                  your chat list.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="add-contact-name"
                      className="mb-1 block text-sm font-medium text-zinc-300"
                    >
                      Saved name
                    </label>
                    <input
                      id="add-contact-name"
                      type="text"
                      value={addContactName}
                      onChange={(e) => setAddContactName(e.target.value)}
                      placeholder="How should this contact appear?"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-contact-phone"
                      className="mb-1 block text-sm font-medium text-zinc-300"
                    >
                      Phone number
                    </label>
                    <input
                      id="add-contact-phone"
                      type="tel"
                      value={addContactPhone}
                      onChange={(e) => setAddContactPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowAddContactView(false)}
                      className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addContact}
                      disabled={
                        addingContact ||
                        !addContactName.trim() ||
                        !addContactPhone.trim()
                      }
                      className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                    >
                      {addingContact ? "Saving..." : "Save contact"}
                    </button>
                  </div>
                </div>
              </div>
            ) : showContactDetails && selectedConversationUser ? (
              <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="h-28 w-28 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                    {selectedConversationUser.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedConversationUser.avatar}
                        alt={getPhoneDisplayName(selectedConversationUser)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-400">
                        {getPhoneDisplayName(selectedConversationUser)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-semibold text-white">
                      {getPhoneDisplayName(selectedConversationUser)}
                    </h3>
                    {getAccountName(selectedConversationUser) && (
                      <p className="mt-1 text-sm text-zinc-500">
                        ~{getAccountName(selectedConversationUser)}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-zinc-400">
                      {selectedConversationUser.email}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {selectedConversationUser.phone || "No phone number"}
                    </p>
                    <p className="mt-4 inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300">
                      {selectedConversationUserOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {selectedConversationIsSaved ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Saved name
                      </p>
                      {editingContactSavedName ? (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={contactSavedName}
                            onChange={(e) => setContactSavedName(e.target.value)}
                            maxLength={80}
                            placeholder="How should this contact appear?"
                            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                          />
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setContactSavedName(
                                  selectedConversationUser.savedName ||
                                    selectedConversationUser.name,
                                );
                                setEditingContactSavedName(false);
                              }}
                              className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveContactName}
                              disabled={
                                savingContactName ||
                                !contactSavedName.trim() ||
                                contactSavedName.trim() ===
                                  (selectedConversationUser.savedName ||
                                    selectedConversationUser.name)
                              }
                              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                            >
                              {savingContactName ? "Saving..." : "Save name"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-zinc-200">
                            {selectedConversationUser.savedName ||
                              selectedConversationUser.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditingContactSavedName(true)}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-white"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Contact
                      </p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-zinc-300">
                          This number is not saved in your contacts yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => openAddContactForUser(selectedConversationUser)}
                          className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
                        >
                          Add to contact
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </p>
                    <p className="mt-2 text-sm text-zinc-200">
                      {selectedConversationUser.status || "Available"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Phone
                    </p>
                    <p className="mt-2 text-sm text-zinc-200">
                      {selectedConversationUser.phone || "Not shared"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Bio
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                    {selectedConversationUser.bio || "No bio added yet."}
                  </p>
                </div>

                {selectedConversationIsSaved && (
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={deleteSavedContact}
                      className="rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                    >
                      Delete saved contact
                    </button>
                  </div>
                )}
              </div>
            ) : !selectedConversationId ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                Start by clicking a contact on the left.
              </div>
            ) : loadingMessages ? (
              <p className="text-zinc-400">Loading messages...</p>
            ) : (
              <div className="space-y-3">
                {selectedConversation?.pinnedMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      const pinnedElement = document.getElementById(
                        `message-${selectedConversation.pinnedMessage?._id}`,
                      );
                      pinnedElement?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                    className="flex w-full items-start gap-3 rounded-2xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-left"
                  >
                    <Pin size={16} className="mt-0.5 shrink-0 text-amber-300" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-100">
                        Pinned message
                      </p>
                      <p className="mt-1 truncate text-sm text-amber-50/80">
                        {getMessagePreview(selectedConversation.pinnedMessage)}
                      </p>
                    </div>
                  </button>
                )}

                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                    No messages yet. Send the first message.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender?._id === currentUserId;
                    const isSelected = selectedMessageIds.includes(message._id);
                    const isPinned =
                      selectedConversation?.pinnedMessage?._id === message._id;

                    return (
                      <div
                        id={`message-${message._id}`}
                        key={message._id}
                        onClick={() => {
                          if (selectionMode) {
                            toggleMessageSelection(message._id);
                          }
                        }}
                        className={`group flex items-center gap-2 ${
                          isMine ? "justify-end" : "justify-start"
                        } ${selectionMode ? "cursor-pointer" : ""}`}
                      >
                        {selectionMode && !isMine && (
                          <div className="shrink-0 text-emerald-400">
                            {isSelected ? (
                              <CheckSquare size={20} className="fill-emerald-400/10" />
                            ) : (
                              <Square size={20} className="text-zinc-500" />
                            )}
                          </div>
                        )}
                        <div
                          data-message-menu-root
                          className={`relative max-w-[85%] rounded-2xl border p-3 sm:max-w-xl sm:p-4 ${
                            isMine
                              ? "border-emerald-700 bg-emerald-900/20"
                              : "border-zinc-800 bg-zinc-900"
                          } ${
                            isSelected
                              ? "ring-2 ring-emerald-400/70"
                              : isPinned
                              ? "ring-2 ring-amber-300/50"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessageMenuId((prev) =>
                                prev === message._id ? "" : message._id,
                              );
                            }}
                            className="absolute right-2 top-2 rounded-lg p-1 text-zinc-400 opacity-0 transition hover:bg-black/20 hover:text-white group-hover:opacity-100"
                          >
                            <ChevronDown size={16} />
                          </button>

                          {messageMenuId === message._id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-2 top-10 z-20 w-48 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl"
                            >
                              <button
                                type="button"
                                onClick={() => toggleMessageSelection(message._id)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-emerald-400" />
                                ) : (
                                  <Square size={16} className="text-zinc-400" />
                                )}
                                <span>Select</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startReplyingToMessage(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                <Reply size={16} className="text-emerald-400" />
                                <span>Reply</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyMessage(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                <Copy size={16} className="text-emerald-400" />
                                <span>Copy</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startForwardingMessage(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                <Forward size={16} className="text-emerald-400" />
                                <span>Forward</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void togglePinMessage(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                <Pin size={16} className="text-amber-300" />
                                <span>{isPinned ? "Unpin" : "Pin"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleStarMessage(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                              >
                                <Star
                                  size={16}
                                  className={
                                    message.starred ? "fill-amber-300 text-amber-300" : "text-amber-300"
                                  }
                                />
                                <span>{message.starred ? "Unstar" : "Star"}</span>
                              </button>
                              {isMine &&
                                !message.deletedForEveryone &&
                                message.text?.trim() && (
                                <button
                                  type="button"
                                  onClick={() => startEditingMessage(message)}
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                                >
                                  <PenSquare size={16} className="text-emerald-400" />
                                  <span>Edit</span>
                                </button>
                              )}
                              <div className="rounded-xl">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteOptionsMessageId((prev) =>
                                      prev === message._id ? "" : message._id,
                                    )
                                  }
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-zinc-900"
                                >
                                  <Trash2 size={16} />
                                  <span>Delete</span>
                                </button>
                                {deleteOptionsMessageId === message._id && (
                                  <div className="mt-1 space-y-1 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2">
                                    <button
                                      type="button"
                                      onClick={() => void deleteMessage(message, "me")}
                                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                                    >
                                      <Trash2 size={15} className="text-red-300" />
                                      <span>Delete for me</span>
                                    </button>
                                    {isMine && !message.deletedForEveryone && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteMessage(message, "everyone")
                                        }
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-300 transition hover:bg-zinc-900"
                                      >
                                        <Trash2 size={15} />
                                        <span>Delete for everyone</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mb-2 flex items-center justify-between gap-3 pr-7">
                            <div className="flex min-w-0 items-center gap-2">
                              {renderAvatar(
                                {
                                  name: isMine
                                    ? currentUserName
                                    : getDisplayName(message.sender),
                                  avatar: isMine
                                    ? profileAvatar || profile?.avatar
                                    : message.sender?.avatar,
                                },
                                "h-7 w-7",
                              )}
                              <p className="truncate text-sm text-emerald-400">
                                {isMine ? "You" : getDisplayName(message.sender)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {message.starred && (
                                <Star size={13} className="fill-amber-300 text-amber-300" />
                              )}
                              {isPinned && (
                                <Pin size={13} className="text-amber-300" />
                              )}
                            </div>
                          </div>
                          {message.replyTo && (
                            <div className="mb-2 rounded-xl border-l-2 border-emerald-400/70 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                              <p className="font-medium text-emerald-300">
                                {message.replyTo.sender?._id === currentUserId
                                  ? "You"
                                  : getDisplayName(message.replyTo.sender) ||
                                    "Message"}
                              </p>
                              <p className="mt-1 truncate">
                                {getMessagePreview(message.replyTo)}
                              </p>
                            </div>
                          )}
                          {message.deletedForEveryone ? (
                            <p className="italic text-zinc-400">
                              This message was deleted
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {message.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={message.image}
                                  alt="GIF message"
                                  className="max-h-64 rounded-xl object-cover"
                                />
                              )}
                              {message.text?.trim() && (
                                <p className="text-zinc-100">{message.text.trim()}</p>
                              )}
                              {!message.image && !message.text?.trim() && (
                                <p className="text-zinc-100">[image]</p>
                              )}
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                            <span>
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-2">
                              {message.edited && !message.deletedForEveryone && (
                                <span>Edited</span>
                              )}
                              {isMine && <span>{getMessageStatus(message)}</span>}
                            </div>
                          </div>
                        </div>
                        {selectionMode && isMine && (
                          <div className="shrink-0 text-emerald-400">
                            {isSelected ? (
                              <CheckSquare size={20} className="fill-emerald-400/10" />
                            ) : (
                              <Square size={20} className="text-zinc-500" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {typingUserName && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                      {typingUserName} is typing...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

            {selectedConversationId &&
              !showProfileEditor &&
              !showSecurityView &&
              !showAddContactView &&
              !showContactDetails && (
            <div className="shrink-0 border-t border-zinc-800 p-3 sm:p-4">
              {selectionMode ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-lg shadow-black/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={clearSelectedMessages}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                      >
                        <X size={18} />
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {selectedMessageIds.length} selected
                        </p>
                        <p className="text-xs text-zinc-400">
                          Choose what to do with the selected messages
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copySelectedMessages()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-200 transition hover:border-emerald-500 hover:text-white"
                      >
                        <Copy size={16} />
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void starSelectedMessages()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-200 transition hover:border-amber-400 hover:text-white"
                      >
                        <Star
                          size={16}
                          className={
                            allSelectedMessagesStarred
                              ? "fill-amber-300 text-amber-300"
                              : "text-amber-300"
                          }
                        />
                        <span>{allSelectedMessagesStarred ? "Unstar" : "Star"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSelectedMessages()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-red-300 transition hover:border-red-400 hover:text-red-200"
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={startForwardingSelectedMessages}
                        className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm transition ${
                          forwardingSelectedMessages
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-emerald-500 hover:text-white"
                        }`}
                      >
                        <Forward size={16} />
                        <span>Forward</span>
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {forwardingSelectedMessages
                      ? "Forward mode is active. Open another contact or conversation from the left."
                      : "The normal message box is hidden while messages are selected."}
                  </p>
                </div>
              ) : (
                <div
                  ref={composerRef}
                  className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-lg shadow-black/10"
                >
                  {(replyingToMessage || editingMessageId || forwardingMessage) && (
                    <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            {editingMessageId
                              ? "Editing message"
                              : forwardingMessage
                              ? "Forward mode active"
                              : "Replying to message"}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-400">
                            {editingMessageId
                              ? "Update the text and send to save your edit."
                              : forwardingMessage
                              ? "Pick another contact or conversation from the left."
                              : getMessagePreview(replyingToMessage)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToMessage(null);
                            setEditingMessageId("");
                            setEditingImagePreview("");
                            setForwardingMessage(null);
                          }}
                          className="rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {editingImagePreview && (
                    <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Current GIF
                          </p>
                          <p className="text-xs text-zinc-400">
                            Editing the caption for this GIF
                          </p>
                        </div>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingImagePreview}
                        alt="Current GIF"
                        className="max-h-40 rounded-xl object-cover"
                      />
                    </div>
                  )}

                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
                      <EmojiPicker
                        width={320}
                        height={420}
                        theme="dark"
                        lazyLoadEmojis
                        searchPlaceholder="Search emojis"
                        onEmojiClick={(emojiData: EmojiClickData) =>
                          addEmoji(emojiData.emoji)
                        }
                      />
                    </div>
                  )}

                  {showGifPicker && (
                    <div className="absolute bottom-full left-0 mb-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
                      {giphyApiKey ? (
                        <div className="p-3">
                          <div className="mb-3">
                            <input
                              type="text"
                              value={gifSearchTerm}
                              onChange={(e) => setGifSearchTerm(e.target.value)}
                              placeholder="Search GIFs"
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500"
                            />
                          </div>
                          <div className="max-h-[26rem] overflow-y-auto">
                            <Grid
                              key={deferredGifSearchTerm || "trending"}
                              width={340}
                              columns={2}
                              gutter={8}
                              noLink
                              fetchGifs={fetchGifs}
                              onGifClick={(gif: GiphyGif, e: Event) => {
                                e.preventDefault();
                                const src = gif.images?.original?.url;
                                if (src) {
                                  stageGifMessage(src);
                                }
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-zinc-300">
                          <p className="font-medium text-white">GIF picker needs setup</p>
                          <p className="mt-2 text-zinc-400">
                            Add `NEXT_PUBLIC_GIPHY_API_KEY` to your env file to enable
                            the full Giphy GIF picker.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {showComposerMenu && (
                    <div className="absolute bottom-full left-0 mb-3 w-56 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker(true);
                          setShowGifPicker(false);
                          setShowComposerMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                      >
                        <Smile size={18} className="text-emerald-400" />
                        <span>Emoji</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowGifPicker(true);
                          setShowEmojiPicker(false);
                          setShowComposerMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                      >
                        <Gift size={18} className="text-emerald-400" />
                        <span>GIF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowComposerMenu(false);
                          openAttachmentPicker();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                      >
                        <Paperclip size={18} className="text-emerald-400" />
                        <span>Photo or GIF</span>
                      </button>
                    </div>
                  )}

                  {pendingAttachment && (
                    <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Attachment ready
                          </p>
                          <p className="text-xs text-zinc-400">
                            {pendingAttachment.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingAttachment(null)}
                          className="rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingAttachment.dataUrl}
                        alt={pendingAttachment.name}
                        className="max-h-40 rounded-xl object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex gap-2">
                      <input {...getInputProps()} />
                      <button
                        type="button"
                        onClick={() => {
                          setShowComposerMenu((prev) => !prev);
                          setShowEmojiPicker(false);
                          setShowGifPicker(false);
                        }}
                        disabled={sending}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="message-input" className="sr-only">
                        Type your message
                      </label>
                      <input
                        id="message-input"
                        type="text"
                        placeholder={
                          editingMessageId
                            ? "Edit your message..."
                            : "Type a message..."
                        }
                        value={messageText}
                        onChange={(e) => handleTyping(e.target.value)}
                        disabled={sending}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            sendMessage();
                          }
                        }}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={sending || !selectedUserId || (!messageText.trim() && !pendingAttachment)}
                      className="inline-flex min-w-28 items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                    >
                      {sending ? "Sending..." : editingMessageId ? "Save" : "Send"}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {forwardingMessage
                      ? "Forward mode is active. Open another contact or conversation to send this message there."
                      : "Press Enter to send. Use the paperclip for attachments, emoji for reactions, and GIF for Giphy."}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
