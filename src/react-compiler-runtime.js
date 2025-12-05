// Mock React compiler-runtime for React 18 compatibility
// This provides the missing compiler-runtime that Payload CMS 3.0.0 expects

// React 19 compiler functions that Payload CMS expects
export const c = (fn) => {
  // Mock implementation - just return the function
  return fn
}

export const useMemoCache = () => {
  // Mock implementation for React 18
  return []
}

export const useMemo = (factory, deps) => {
  // Fallback to React's useMemo
  const React = require('react')
  return React.useMemo(factory, deps)
}

export const useCallback = (callback, deps) => {
  // Fallback to React's useCallback
  const React = require('react')
  return React.useCallback(callback, deps)
}

export const useState = (initialState) => {
  // Fallback to React's useState
  const React = require('react')
  return React.useState(initialState)
}

export const useEffect = (effect, deps) => {
  // Fallback to React's useEffect
  const React = require('react')
  return React.useEffect(effect, deps)
}

export const useRef = (initialValue) => {
  // Fallback to React's useRef
  const React = require('react')
  return React.useRef(initialValue)
}

export const useContext = (context) => {
  // Fallback to React's useContext
  const React = require('react')
  return React.useContext(context)
}

export const useReducer = (reducer, initialState, init) => {
  // Fallback to React's useReducer
  const React = require('react')
  return React.useReducer(reducer, initialState, init)
}

export const useLayoutEffect = (effect, deps) => {
  // Fallback to React's useLayoutEffect
  const React = require('react')
  return React.useLayoutEffect(effect, deps)
}

export const useImperativeHandle = (ref, createHandle, deps) => {
  // Fallback to React's useImperativeHandle
  const React = require('react')
  return React.useImperativeHandle(ref, createHandle, deps)
}

export const useDebugValue = (value, formatter) => {
  // Fallback to React's useDebugValue
  const React = require('react')
  return React.useDebugValue(value, formatter)
}

export const useDeferredValue = (value) => {
  // Fallback to React's useDeferredValue
  const React = require('react')
  return React.useDeferredValue(value)
}

export const useTransition = () => {
  // Fallback to React's useTransition
  const React = require('react')
  return React.useTransition()
}

export const useId = () => {
  // Fallback to React's useId
  const React = require('react')
  return React.useId()
}

export const useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) => {
  // Fallback to React's useSyncExternalStore
  const React = require('react')
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const useInsertionEffect = (effect, deps) => {
  // Fallback to React's useInsertionEffect
  const React = require('react')
  return React.useInsertionEffect(effect, deps)
}

// Export all as default
export default {
  c,
  useMemoCache,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  useContext,
  useReducer,
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useId,
  useSyncExternalStore,
  useInsertionEffect,
}
